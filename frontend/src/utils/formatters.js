export function formatCurrency(amount) {
  if (!amount && amount !== 0) return 'N/A';
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
