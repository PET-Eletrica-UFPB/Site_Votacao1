// Desenhos dos projetos. Depois podem virar fotos reais.
const ARTES = {
  solar: `<circle cx="150" cy="44" r="20"/><path d="M150 12v-8M150 84v-8M118 44h-8M190 44h-8M127 21l-6-6M179 73l-6-6M127 67l-6 6M179 15l-6 6"/><path d="M24 150l26-62h90l-14 62zM37 119h97M57 88l-12 62M87 88l-7 62M117 88l-6 62"/><path d="M78 150v28M52 180h52"/>`,
  turbina: `<path d="M94 196l4-104M106 196l-4-104"/><circle cx="100" cy="82" r="8"/><path d="M100 74c-8-24-7-48 0-70 8 22 8 46 0 70zM107 86c24-4 46 4 64 20-24 6-46 0-64-20zM93 86c-24-4-46 4-64 20 24 6 46 0 64-20z"/><path d="M70 196h60"/>`,
  folha: `<path d="M34 170C22 90 70 26 172 24c6 96-46 156-138 146z"/><path d="M34 170C60 124 96 88 136 62M72 128l-4-36M100 100l-2-30M76 126l40 6M104 98l36 6"/>`,
  braco: `<path d="M56 186h88M72 186v-22h56v22"/><circle cx="100" cy="150" r="14"/><path d="M90 140 56 84M110 140 76 72"/><circle cx="62" cy="68" r="14"/><path d="M74 58l58-30M68 54l54-34"/><circle cx="134" cy="26" r="9"/><path d="M142 32l22 12M164 44l12-10M164 44l10 14"/>`,
  gota: `<path d="M100 14c30 42 58 72 58 108a58 58 0 0 1-116 0c0-36 28-66 58-108z"/><path d="M100 160v-52M100 128c-4-18-18-28-36-26 2 18 18 30 36 26zM100 112c2-16 16-26 32-24-2 16-16 28-32 24z"/>`,
  casa: `<path d="M22 94 100 26l78 68M42 78v102h116V78"/><path d="M110 88 82 134h22l-10 34 34-52h-24z"/><path d="M138 44V26h16v32"/>`,
  onda: `<rect x="16" y="36" width="168" height="128" rx="14"/><path d="M16 100h168M100 36v128" opacity=".45"/><path d="M26 100c12-68 28-68 40 0s28 68 40 0 28-68 40 0 20 44 28 30"/>`,
  bateria: `<rect x="50" y="36" width="100" height="148" rx="12"/><path d="M80 36V20h40v16"/><path d="M110 58 82 112h24l-12 50 34-64h-24z"/>`,
  raio: `<path d="M64 192 92 26h16l28 166M52 72h96M38 104h124M78 118l48 46M122 118l-48 46M86 66l28 38M114 66l-28 38"/><path d="M52 72v12M148 72v12M38 104v12M162 104v12"/>`,
};

const svgArte = (arte) => `<svg viewBox="0 0 200 200" aria-hidden="true">${ARTES[arte] || ""}</svg>`;
