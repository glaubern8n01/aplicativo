// FIX: Use a standard Deno lib reference for Deno global types.
/// <reference lib="esnext" /> 
/// <reference lib="dom" />


import { GoogleGenAI, GenerateContentResponse } from "https://esm.sh/@google/genai@^1.0.0"; // Using esm.sh for Deno
// Make sure to import or define these types if they are complex
// For simplicity, using 'any' for AddressInfo/UserCoordinates from frontend if not sharing types directly
// import type { AddressInfo, ParsedAddressFromAI, UserCoordinates } from './types'; // If you have a shared types file

// Define simple interfaces for expected payload types for clarity within the function
interface ParsedAddressFromAI {
  fullAddress?: string;
  street?: string;
  number?: string;
  bairro?: string;
  complemento?: string;
  cep?: string;
  city?: string;
  state?: string;
  recipientName?: string;
  telefone?: string;
}

interface AddressInfo {
  id: string;
  fullAddress: string;
  recipientName?: string;
  telefone?: string;
  // other fields from your frontend AddressInfo type
}

interface UserCoordinates {
  latitude: number;
  longitude: number;
}


const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL_TEXT = 'gemini-2.5-flash-preview-04-17';

let ai: GoogleGenAI | null = null;

if (GEMINI_API_KEY) {
  // FIX: Use named parameter for apiKey
  ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
} else {
  console.error("CRITICAL: GEMINI_API_KEY environment variable is not set in Supabase Function.");
}

// Helper to parse JSON from Gemini response, handling markdown fences
const parseJsonFromGeminiResponse = <T,>(responseText: string): T | null => {
  let jsonStr = responseText.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }
  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error("Failed to parse JSON response from Gemini:", e, "Raw response text:", responseText);
    // Attempt to fix common issues
     try {
        const fixedJsonStr = jsonStr
            .replace(/,\s*\]/g, ']') // trailing comma in array
            .replace(/,\s*\}/g, '}'); // trailing comma in object
        return JSON.parse(fixedJsonStr) as T;
    } catch (e2) {
        console.error("Failed to parse JSON response even after attempting to fix common issues:", e2);
        return null;
    }
  }
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*', // Adjust for your frontend URL in production
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Add 'Authorization' if you plan to use Supabase JWT
      },
      status: 204,
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Adjust for your frontend URL in production
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };


  if (!ai) {
    return new Response(JSON.stringify({ message: "Gemini AI service not initialized on server (API key missing)." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: "Method not allowed. Please use POST." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let requestBody;
  try {
    requestBody = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ message: "Invalid JSON payload." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { task, payload } = requestBody;

  if (!task || !payload) {
    return new Response(JSON.stringify({ message: "Missing 'task' or 'payload' in request body." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let geminiResponse: GenerateContentResponse;
    let prompt: string; // Define prompt variable here to be accessible in switch cases

    switch (task) {
      case 'parseTextChunk':
        const { textChunk } = payload as { textChunk: string };
        if (!textChunk) throw new Error("Missing textChunk in payload for parseTextChunk task.");

        prompt = `
          Extraia todos os endereços distintos do texto abaixo. Para cada endereço, identifique:
          - "recipientName": O nome do destinatário ou cliente (opcional).
          - "street": A rua/avenida.
          - "number": O número da residência/prédio. Diferencie este do número de telefone.
          - "bairro": O bairro.
          - "complemento": Informações adicionais como apartamento, bloco, ponto de referência (opcional).
          - "cep": O código postal.
          - "city": A cidade.
          - "state": O estado (sigla).
          - "fullAddress": O endereço principal completo (rua, número, bairro, cidade, estado, CEP), idealmente sem complemento ou telefone.
          - "telefone": O número de telefone do destinatário (ex: (XX) XXXXX-XXXX, XXXXX-XXXX, WhatsApp, contato). Se um número parecer ser um telefone, coloque-o neste campo. Não inclua o telefone nos campos de endereço.

          Se uma informação não estiver presente, deixe o campo correspondente vazio ou omita-o.
          Retorne o resultado como um array JSON de objetos. Cada objeto deve ter as chaves mencionadas acima.
          Se nenhum endereço for encontrado ou o texto não contiver endereços, retorne um array JSON vazio [].

          Texto para análise:
          ---
          ${textChunk}
          ---
        `;
        geminiResponse = await ai.models.generateContent({
          model: GEMINI_MODEL_TEXT,
          contents: prompt,
          config: { responseMimeType: "application/json", temperature: 0.1 }
        });
        const parsedTextData = parseJsonFromGeminiResponse<ParsedAddressFromAI[]>(geminiResponse.text);
        return new Response(JSON.stringify(parsedTextData || []), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });

      case 'parseImage':
        const { base64ImageData, mimeType } = payload as { base64ImageData: string; mimeType: string };
        if (!base64ImageData || !mimeType) throw new Error("Missing base64ImageData or mimeType for parseImage task.");

        const imagePart = { inlineData: { mimeType, data: base64ImageData.split(',')[1] } };
        const imageTextPrompt = `
          Extraia todos os endereços distintos da imagem. Para cada endereço, identifique:
          - "recipientName": O nome do destinatário ou cliente (opcional).
          - "street": A rua/avenida.
          - "number": O número da residência/prédio.
          - "bairro": O bairro.
          - "complemento": Informações adicionais (opcional).
          - "cep": O código postal.
          - "city": A cidade.
          - "state": O estado (sigla).
          - "fullAddress": O endereço principal completo.
          - "telefone": O número de telefone do destinatário.

          Retorne o resultado como um array JSON de objetos. Se nenhum endereço for encontrado, retorne um array JSON vazio [].
        `;
        geminiResponse = await ai.models.generateContent({
          model: GEMINI_MODEL_TEXT,
          // FIX: contents should be an object with parts array for multi-part
          contents: { parts: [imagePart, { text: imageTextPrompt }] },
          config: { responseMimeType: "application/json", temperature: 0.1 }
        });
        const parsedImageData = parseJsonFromGeminiResponse<ParsedAddressFromAI[]>(geminiResponse.text);
        return new Response(JSON.stringify(parsedImageData || []), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });

      case 'optimizeRoute':
        const { addresses, currentLocation, manualOriginAddress } = payload as {
          addresses: AddressInfo[];
          currentLocation: UserCoordinates | null;
          manualOriginAddress: string | null;
        };
        if (!addresses) throw new Error("Missing addresses for optimizeRoute task.");

        const addressListText = addresses.map((addr, index) =>
          `${index + 1}. ${addr.fullAddress} (ID original: ${addr.id}${addr.recipientName ? `, Dest: ${addr.recipientName}` : ''}${addr.telefone ? `, Tel: ${addr.telefone}` : ''})`
        ).join('\n');

        let startingPointInstruction = 'Não tenho um ponto de partida específico, então comece pela que fizer mais sentido para iniciar a rota.';
        if (currentLocation) {
          startingPointInstruction = `Comece a rota a partir da localização atual do entregador: Latitude ${currentLocation.latitude.toFixed(6)}, Longitude ${currentLocation.longitude.toFixed(6)}.`;
        } else if (manualOriginAddress) {
          startingPointInstruction = `Comece a rota a partir do seguinte endereço de origem fornecido pelo entregador: ${manualOriginAddress}.`;
        }

        prompt = `
          Você é um assistente de otimização de rotas para entregadores.
          A tarefa é ordenar a seguinte lista de endereços para criar uma rota de entrega eficiente, minimizando o tempo total de viagem.
          ${startingPointInstruction}
          Considere a proximidade geográfica e uma sequência lógica de paradas.
          Retorne a lista de endereços na ordem otimizada. Sua resposta DEVE ser um array JSON de objetos.
          Cada objeto no array deve conter APENAS o "id" original do endereço (extraído da lista de entrada) e a "order" (a nova posição na rota otimizada, começando em 1).

          Lista de endereços para otimizar:
          ---
          ${addressListText}
          ---
        `;
        geminiResponse = await ai.models.generateContent({
          model: GEMINI_MODEL_TEXT,
          contents: prompt,
          config: { responseMimeType: "application/json", temperature: 0.3 }
        });
        const optimizedOrderResult = parseJsonFromGeminiResponse<{ id: string; order: number }[]>(geminiResponse.text);
        return new Response(JSON.stringify(optimizedOrderResult || []), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });

      default:
        return new Response(JSON.stringify({ message: `Unknown task: ${task}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error(`Error processing task ${task}:`, error);
    return new Response(JSON.stringify({ message: error.message || "An internal server error occurred." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});