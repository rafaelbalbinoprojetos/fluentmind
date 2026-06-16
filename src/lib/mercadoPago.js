const SDK_URL = "https://sdk.mercadopago.com/js/v2";

let sdkPromise = null;
const instanceCache = new Map();

function ensureBrowserEnvironment() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("O checkout do Mercado Pago só pode ser aberto no navegador.");
  }
}

function injectSdkScript() {
  ensureBrowserEnvironment();

  const existingScript = document.querySelector(`script[src="${SDK_URL}"]`);
  if (existingScript && window.MercadoPago) {
    return Promise.resolve(window.MercadoPago);
  }

  if (sdkPromise) {
    return sdkPromise;
  }

  sdkPromise = new Promise((resolve, reject) => {
    const script = existingScript ?? document.createElement("script");
    script.type = "text/javascript";
    script.src = SDK_URL;
    script.async = true;

    script.addEventListener("load", () => {
      if (window.MercadoPago) {
        resolve(window.MercadoPago);
      } else {
        reject(new Error("SDK do Mercado Pago não ficou disponível."));
      }
    });

    script.addEventListener("error", () => {
      reject(new Error("Não foi possível carregar o SDK do Mercado Pago."));
    });

    if (!existingScript) {
      document.head.appendChild(script);
    }
  });

  return sdkPromise;
}

export async function loadMercadoPagoSdk() {
  if (typeof window === "undefined") {
    throw new Error("Mercado Pago checkout só pode ser inicializado no navegador.");
  }
  if (typeof window !== "undefined" && window.MercadoPago) {
    return window.MercadoPago;
  }
  return injectSdkScript();
}

export async function getMercadoPagoInstance({ publicKey, locale = "pt-BR" } = {}) {
  if (!publicKey) {
    throw new Error("Configure a variável VITE_MERCADOPAGO_PUBLIC_KEY para habilitar o checkout.");
  }

  const SDK = await loadMercadoPagoSdk();
  const cacheKey = `${publicKey}-${locale}`;
  if (instanceCache.has(cacheKey)) {
    return instanceCache.get(cacheKey);
  }

  const instance = new SDK(publicKey, { locale });
  instanceCache.set(cacheKey, instance);
  return instance;
}

export async function openMercadoPagoCheckout({
  publicKey,
  preferenceId,
  locale = "pt-BR",
  theme = {},
} = {}) {
  if (!preferenceId) {
    throw new Error("Preferência do checkout não encontrada.");
  }

  const mercadopago = await getMercadoPagoInstance({ publicKey, locale });

  const checkoutConfig = {
    preference: { id: preferenceId },
    autoOpen: true,
    onError: (error) => {
      console.error("[mercadopago] Checkout falhou", error);
    },
  };

  const elementsColor = theme.elementsColor?.trim();
  const headerColor = theme.headerColor?.trim();
  if (elementsColor || headerColor) {
    checkoutConfig.theme = {
      ...(elementsColor ? { elementsColor } : {}),
      ...(headerColor ? { headerColor } : {}),
    };
  }

  mercadopago.checkout(checkoutConfig);
  return true;
}
