const variable = 'counter';
let value = trufos.getCollectionVariable(variable);
console.log(`Current value of ${variable}:`, value);
value = parseInt(value || '0');
console.log(`Parsed value of ${variable}:`, value);
value++;
console.log(`Incremented value of ${variable}:`, value);
trufos.setCollectionVariable(variable, value.toString());
