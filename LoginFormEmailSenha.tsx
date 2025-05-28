import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Input, Button, Alert, UserIcon, LockClosedIcon } from './uiComponents';

export function LoginFormEmailSenha() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const fazerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha
    });

    if (error) {
      setErro('Erro ao fazer login: ' + error.message);
    } else {
      window.location.reload();
    }

    setCarregando(false);
  };

  return (
    <form onSubmit={fazerLogin} className="space-y-4 max-w-sm mx-auto mt-8">
      <h2 className="text-xl font-semibold text-center">Login por Email</h2>

      {erro && <Alert type="error" message={erro} />}

      <Input
        label="Email"
        type="email"
        placeholder="seu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        icon={<UserIcon />}
        required
      />

      <Input
        label="Senha"
        type="password"
        placeholder="••••••••"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        icon={<LockClosedIcon />}
        required
      />

      <Button type="submit" variant="primary" isLoading={carregando} className="w-full">
        Entrar
      </Button>
    </form>
  );
}
