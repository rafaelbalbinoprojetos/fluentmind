function ensureAccessToken(accessToken) {
  if (!accessToken) {
    throw new Error("Sessao expirada. Entre novamente para gerar audio.");
  }
}

function normalizeResponse(payload) {
  return {
    exists: Boolean(payload?.exists),
    created: Boolean(payload?.created),
    audio: payload?.audio ?? null,
    signedUrl: payload?.signedUrl ?? null,
  };
}

async function parseError(response) {
  const payload = await response.json().catch(() => null);
  return payload?.error || `Erro ${response.status}`;
}

export async function getMindBlockAudio({ mindblockId, voice = "mineirinha", accessToken }) {
  ensureAccessToken(accessToken);
  const params = new URLSearchParams({ mindblockId, voice });
  const response = await fetch(`/api/mindblock-audio?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return normalizeResponse(await response.json());
}

export async function generateMindBlockAudio({ mindblockId, voice = "mineirinha", accessToken }) {
  ensureAccessToken(accessToken);
  const response = await fetch("/api/mindblock-audio", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mindblockId, voice }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return normalizeResponse(await response.json());
}
