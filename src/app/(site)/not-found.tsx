import { StateCard } from "@/components/StateCard";

export default function NotFound() {
  return <StateCard icon="404" title="Sala não encontrada" text="Confira o endereço ou volte para a lista de salas abertas." href="/" cta="Ir para o início" />;
}
