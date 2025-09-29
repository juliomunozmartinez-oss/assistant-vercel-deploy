export function normalizeName(text: string): string {
  const colors = /(negro|black|azul|blue|rojo|red|verde|green|plata|silver|blanco|white|gris|gray|grafito|graphite|dorado|gold|morado|purple|rosa|pink|titanio|titanium|amarillo|yellow|naranja|orange|beige|cobre|copper)/gi;
  const tech = /(\b(?:4g|5g|lte|3g|nr|uw)\b)/gi;
  const ramStorage = /(\b\d+\s?(?:gb|tb|g|t)\b)/gi;
  const suffixes = /(\b(?:max|pro|air|pv|kit|libre|plus|ultra|se|mini|lite|neo|fe|edge)\b)/gi;

  let s = text.replace(/[-_/]/g, " ");
  s = s.replace(colors, " ");
  s = s.replace(tech, " ");
  s = s.replace(ramStorage, " ");
  s = s.replace(suffixes, " ");
  s = s.replace(/\s+/g, " ").trim();
  // Title case simple
  s = s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
  return s;
}
