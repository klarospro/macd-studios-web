import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Servicios from "@/components/Servicios";
import Trabajos from "@/components/Trabajos";
import ComoFunciona from "@/components/ComoFunciona";
import Planes from "@/components/Planes";
import EraDigital from "@/components/EraDigital";
import BotMACD from "@/components/BotMACD";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Servicios />
      <Trabajos />
      <ComoFunciona />
      <Planes />
      <EraDigital />
      <BotMACD />
      <Footer />
    </main>
  );
}
