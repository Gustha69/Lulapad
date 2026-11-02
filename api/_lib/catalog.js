// Fonte da verdade de preços e custos. O navegador NUNCA define valores.
// Preços em centavos de real (BRL).
const PACKS = [
  { id: 'p10',  credits: 10,  amount: 200,  tag: '' },
  { id: 'p50',  credits: 50,  amount: 799,  tag: 'Mais vendido' },
  { id: 'p100', credits: 100, amount: 4999, tag: '' },
];

// Custo em créditos de cada item (igual ao exibido no front).
const ITEMS = {
  flower: 5, cake: 10, gift: 20,      // Love
  pie: 5, mosquito: 15, pepper: 30,   // Hate
};

const brl = (cents) => 'R$ ' + (cents / 100).toFixed(2).replace('.', ',');

module.exports = { PACKS, ITEMS, brl };
