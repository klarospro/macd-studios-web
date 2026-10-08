// Canales de contacto de la web pública de MACD Studios.
export const WHATSAPP_NUMERO = "34623474706";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMERO}`;
export const TELEGRAM_URL = "https://t.me/macdstudios_bot";

// Enlace de WhatsApp con el mensaje ya escrito.
export function whatsappConTexto(texto: string): string {
  return `${WHATSAPP_URL}?text=${encodeURIComponent(texto)}`;
}

export const PEDIR_PRESUPUESTO_URL = whatsappConTexto(
  "Hola Moisés, vengo de la web de MACD Studios y quiero pedir un presupuesto.",
);
