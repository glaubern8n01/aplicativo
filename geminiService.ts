
// Ensure UserCoordinates is imported if it's defined in types.ts, or define it locally
import type { AddressInfo, ParsedAddressFromAI, UserCoordinates } from './types';

// IMPORTANT: Replace this with your actual Supabase Function URL
const SUPABASE_GEMINI_PROXY_URL = 'YOUR_SUPABASE_FUNCTION_URL_HERE/gemini-proxy';

const MAX_CHUNK_CHAR_LENGTH = 50000; // Max characters per chunk to send to Gemini

// Generic function to call the backend proxy
async function callProxy<T>(task: string, payload: any): Promise<T> {
  if (SUPABASE_GEMINI_PROXY_URL === 'YOUR_SUPABASE_FUNCTION_URL_HERE/gemini-proxy') {
    console.error("CRITICAL: SUPABASE_GEMINI_PROXY_URL is not set in geminiService.ts. Please update it with your deployed Supabase function URL.");
    throw new Error("RotaSpeed backend proxy is not configured. Please contact support or check configuration.");
  }

  try {
    const response = await fetch(SUPABASE_GEMINI_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ task, payload }),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        // If response is not JSON, use text
        errorData = { message: await response.text() };
      }
      console.error(`Error from proxy for task ${task}:`, response.status, errorData);
      throw new Error(errorData?.message || `Proxy request failed for task ${task} with status ${response.status}`);
    }
    return await response.json() as T;
  } catch (error) {
    console.error(`Network or other error calling proxy for task ${task}:`, error);
    throw error; // Re-throw the error to be caught by the calling function
  }
}


const callGeminiForTextChunk = async (textChunk: string): Promise<ParsedAddressFromAI[]> => {
  try {
    const result = await callProxy<ParsedAddressFromAI[]>('parseTextChunk', { textChunk });
    // The proxy is expected to return an array, ensure it does.
    return Array.isArray(result) ? result : (result ? [result as unknown as ParsedAddressFromAI] : []);
  } catch (error) {
    console.error(`Error processing text chunk via proxy: ${error}. Chunk: ${textChunk.substring(0,200)}...`);
    return []; // Return empty array on error as per original logic
  }
}


export const parseAddressFromTextWithGemini = async (text: string): Promise<ParsedAddressFromAI[]> => {
  if (!text.trim()) {
    return [];
  }

  if (text.length <= MAX_CHUNK_CHAR_LENGTH) {
    return callGeminiForTextChunk(text);
  }

  console.log(`Text length (${text.length}) exceeds max chunk length (${MAX_CHUNK_CHAR_LENGTH}). Splitting into chunks.`);
  const allParsedAddresses: ParsedAddressFromAI[] = [];
  const lines = text.split('\n');
  let currentChunk = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (currentChunk.length + line.length + 1 > MAX_CHUNK_CHAR_LENGTH && currentChunk.length > 0) {
      console.log(`Processing chunk of length ${currentChunk.length}`);
      const parsedFromChunk = await callGeminiForTextChunk(currentChunk);
      allParsedAddresses.push(...parsedFromChunk);
      currentChunk = "";
    }

    if (currentChunk.length > 0) {
      currentChunk += "\n";
    }
    currentChunk += line;

     if (line.length > MAX_CHUNK_CHAR_LENGTH) {
        console.warn(`A single line of length ${line.length} exceeds MAX_CHUNK_CHAR_LENGTH. Processing it as a separate chunk.`);
        if(currentChunk.length > line.length) {
            const chunkBeforeLongLine = currentChunk.substring(0, currentChunk.length - line.length -1);
             if(chunkBeforeLongLine.trim().length > 0) {
                console.log(`Processing chunk before very long line, length ${chunkBeforeLongLine.length}`);
                const parsedFromChunk = await callGeminiForTextChunk(chunkBeforeLongLine);
                allParsedAddresses.push(...parsedFromChunk);
             }
        }
        console.log(`Processing very long line as a chunk, length ${line.length}`);
        const parsedFromLongLine = await callGeminiForTextChunk(line);
        allParsedAddresses.push(...parsedFromLongLine);
        currentChunk = "";
        continue;
    }
  }

  if (currentChunk.length > 0) {
    console.log(`Processing final chunk of length ${currentChunk.length}`);
    const parsedFromChunk = await callGeminiForTextChunk(currentChunk);
    allParsedAddresses.push(...parsedFromChunk);
  }

  console.log(`Total parsed addresses after chunking: ${allParsedAddresses.length}`);
  return allParsedAddresses;
};


export const parseAddressFromImageWithGemini = async (base64ImageData: string, mimeType: string): Promise<ParsedAddressFromAI[]> => {
  try {
    const result = await callProxy<ParsedAddressFromAI[]>('parseImage', { base64ImageData, mimeType });
    return Array.isArray(result) ? result : (result ? [result as unknown as ParsedAddressFromAI] : []);
  } catch (error) {
    console.error("Error calling proxy for address parsing from image:", error);
    return [];
  }
};

export const optimizeRouteWithGemini = async (
    addresses: AddressInfo[],
    currentLocation: UserCoordinates | null,
    manualOriginAddress: string | null
): Promise<(AddressInfo & { order: number })[]> => {
  if (addresses.length === 0) return [];
  if (addresses.length === 1) return [{ ...addresses[0], order: 1 }];

  try {
    const optimizedOrderResult = await callProxy<{ id: string; order: number }[]>('optimizeRoute', {
      addresses,
      currentLocation,
      manualOriginAddress,
    });

    if (!optimizedOrderResult || !Array.isArray(optimizedOrderResult) || optimizedOrderResult.some(item => typeof item.id === 'undefined' || typeof item.order === 'undefined')) {
      console.error("Failed to parse optimized route from proxy or invalid format:", optimizedOrderResult);
      return addresses.map((addr, index) => ({ ...addr, order: index + 1 })); // Fallback
    }

    const addressMap = new Map(addresses.map(addr => [addr.id, addr]));
    const sortedAddresses: (AddressInfo & { order: number })[] = [];

    optimizedOrderResult.sort((a, b) => a.order - b.order);

    for (const item of optimizedOrderResult) {
        const originalAddress = addressMap.get(item.id);
        if (originalAddress) {
            sortedAddresses.push({ ...originalAddress, order: item.order });
        } else {
            console.warn(`Address with ID ${item.id} from proxy's optimized route not found in original list.`);
        }
    }

     if (sortedAddresses.length !== addresses.length) {
        console.warn("Mismatch in address count after optimization via proxy. Some addresses might be missing or duplicated. Appending missing ones.");
        const presentIds = new Set(sortedAddresses.map(sa => sa.id));
        let maxOrder = sortedAddresses.reduce((max, curr) => Math.max(max, curr.order || 0), 0);

        addresses.forEach(addr => {
            if (!presentIds.has(addr.id)) {
                maxOrder++;
                sortedAddresses.push({...addr, order: maxOrder});
            }
        });
    }
    return sortedAddresses;

  } catch (error) {
    console.error("Error calling proxy for route optimization:", error);
    return addresses.map((addr, index) => ({ ...addr, order: index + 1 })); // Fallback
  }
};

// This function is no longer needed as API key is managed by the backend proxy.
// export const isGeminiAvailable = (): boolean => {
//   return true; // Assuming proxy is always available if configured
// };

// Initialization is handled by the backend proxy.
// initializeGemini();
