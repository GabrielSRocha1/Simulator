// Vercel serverless function: proxy do DAS getAsset da Solana.
// O RPC publico (api.mainnet-beta.solana.com) bloqueia getAsset quando
// chamado de browsers — entao fazemos a chamada server-side.
//
// URL: /api/asset?mint={mint}  →  { image, name, symbol }

module.exports = async (req, res) => {
  const mint = (req.query && req.query.mint) || '';
  if (!mint || !/^[A-Za-z0-9]{32,44}$/.test(mint)) {
    res.status(400).json({ error: 'invalid mint' });
    return;
  }
  try {
    const r = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAsset',
        params: { id: mint },
      }),
    });
    if (!r.ok) { res.status(502).json({}); return; }
    const j = await r.json();
    const c = (j && j.result && j.result.content) || {};
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.status(200).json({
      image:  (c.links && c.links.image) || (c.files && c.files[0] && c.files[0].uri) || null,
      name:   (c.metadata && c.metadata.name)   || null,
      symbol: (c.metadata && c.metadata.symbol) || null,
    });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
};
