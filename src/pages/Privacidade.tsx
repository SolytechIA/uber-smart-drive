import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link to="/"><Logo size="sm" /></Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Política de Privacidade — Drive IA</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: maio de 2026</p>

        <div className="prose prose-invert mt-8 max-w-none space-y-6 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-display text-xl font-semibold">1. Identificação do Controlador</h2>
            <p>Drive IA é um serviço desenvolvido e operado pela <strong>SolyTech Soluções em IA, Automação e Finanças Ltda.</strong>, com sede em Gramado/RS, Brasil.</p>
            <p>Contato do encarregado (DPO): <a className="text-primary hover:underline" href="mailto:contato.solytech@gmail.com">contato.solytech@gmail.com</a></p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">2. Dados Coletados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nome e endereço de e-mail (cadastro)</li>
              <li>Dados de corridas: horário, origem, destino, distância e valor (inseridos pelo próprio usuário)</li>
              <li>Dados do veículo: marca, modelo, tipo de combustível e consumo médio (inseridos pelo próprio usuário)</li>
              <li>Dados financeiros: custos, metas e ganhos (inseridos pelo próprio usuário)</li>
              <li>Dados de uso da plataforma: acessos e funcionalidades utilizadas (coletados automaticamente)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">3. Finalidade do Tratamento</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Prestação do serviço Drive IA (análise de corridas e geração de relatórios)</li>
              <li>Comunicações relacionadas ao serviço e suporte</li>
              <li>Geração de análises por inteligência artificial com base no histórico do próprio usuário</li>
              <li>Processamento de assinaturas via Mercado Pago</li>
              <li>Melhoria contínua da plataforma</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">4. Compartilhamento de Dados</h2>
            <p>Os dados do usuário <strong>NÃO</strong> são vendidos ou compartilhados com terceiros para fins comerciais. Compartilhamos dados apenas com:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Supabase (armazenamento seguro em nuvem)</li>
              <li>Groq (processamento de análise por IA — apenas dados agregados e anonimizados são enviados)</li>
              <li>Mercado Pago (processamento de pagamentos — apenas dados necessários para a transação)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">5. Armazenamento e Segurança</h2>
            <p>Todos os dados são armazenados com criptografia em servidores seguros. Utilizamos autenticação segura e controle de acesso por usuário. Nenhum colaborador tem acesso aos dados individuais de corridas ou financeiros dos usuários.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">6. Prazo de Retenção</h2>
            <p>Os dados são mantidos enquanto a conta estiver ativa. Após o cancelamento da conta, os dados são excluídos em até 30 dias, salvo obrigação legal de retenção.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">7. Direitos do Titular</h2>
            <p>Conforme a LGPD, você tem direito a:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Confirmar a existência de tratamento dos seus dados</li>
              <li>Acessar seus dados a qualquer momento</li>
              <li>Corrigir dados incompletos ou incorretos</li>
              <li>Solicitar a exclusão dos seus dados</li>
              <li>Revogar o consentimento a qualquer momento</li>
              <li>Solicitar portabilidade dos seus dados</li>
            </ul>
            <p>Para exercer qualquer desses direitos, entre em contato pelo e-mail: <a className="text-primary hover:underline" href="mailto:contato.solytech@gmail.com">contato.solytech@gmail.com</a></p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">8. Cookies</h2>
            <p>Utilizamos cookies estritamente necessários para manter sua sessão autenticada. Não utilizamos cookies de rastreamento ou publicidade.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">9. Alterações nesta Política</h2>
            <p>Reservamos o direito de atualizar esta política a qualquer momento. Alterações relevantes serão comunicadas por e-mail com antecedência mínima de 15 dias.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">10. Contato</h2>
            <p>Para dúvidas sobre esta política ou sobre o tratamento dos seus dados:</p>
            <p>E-mail: <a className="text-primary hover:underline" href="mailto:contato.solytech@gmail.com">contato.solytech@gmail.com</a></p>
            <p>Prazo de resposta: até 2 dias úteis</p>
          </section>
        </div>
      </main>
    </div>
  );
}
