const transactions = [
  { category: 'profit_distribution', concept: 'Retiro de Utilidades Socios: Socio Co-Fundador (40%)', grossAmount: 11564 },
  { category: 'profit_distribution', concept: 'Retiro de Utilidades Socios: Socio Principal / Fundador (60%)', grossAmount: 17347 },
  { category: 'profit_distribution', concept: 'Fondo de Emergencia (Retención 50% Profit First - Mes: Septiembre 2026)', grossAmount: 28912 },
  { category: 'profit_distribution', concept: 'Transferencia a Reserva de Ganancias / Fondo de Emergencia', grossAmount: 57823 },
];

for (const t of transactions) {
  const cat = t.category;
  const concept = (t.concept || '').toLowerCase();
  
  if (
    cat === 'owner_draw' || 
    cat === 'profit_distribution' || 
    concept.includes('retiro de socio') || 
    concept.includes('sueldo del dueño') || 
    concept.includes('distribucion de ganancia') ||
    concept.includes('reserva de ganancias') ||
    concept.includes('fondo de emergencia')
  ) {
    console.log(`Matched equity_draw: ${t.grossAmount}`);
  } else {
    console.log(`DID NOT MATCH: ${t.grossAmount}`);
  }
}
