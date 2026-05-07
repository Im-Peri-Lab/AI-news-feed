export default function handler(req: any, res: any) {
  const target = typeof req.query.u === 'string' ? req.query.u : '';
  if (!target) return res.status(400).send('Missing redirect target');
  try {
    const parsed = new URL(target);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).send('Invalid protocol');
    }
    res.redirect(302, parsed.toString());
  } catch {
    res.status(400).send('Invalid redirect target');
  }
}
