
export const WHATSAPP_CONFIG = {
  NOAM: {
      phone: "972586303063",
      message: "Hi Noam, I reached out from the website and would like some general help regarding..."
  },
  AGENT: {
      phone: "19296518827",
      message: "Hello, I am interested in getting more details about professional assistance with American Citizenship..."
  }
};

export function buildWhatsAppUrl(target) {
  const { phone, message } = WHATSAPP_CONFIG[target];
  const q = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${q}`;
}
