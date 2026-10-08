import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Trabajos from "@/components/Trabajos";
import Servicios from "@/components/Servicios";
import ComoFunciona from "@/components/ComoFunciona";
import Planes from "@/components/Planes";
import BotMACD from "@/components/BotMACD";
import OfertasSignup from "@/components/OfertasSignup";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Trabajos />
      <Servicios />
      <ComoFunciona />
      <Planes />
      <BotMACD />
      <OfertasSignup />
      <Footer />
    </main>
  );
}
