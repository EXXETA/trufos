const key = 'counter';
const value = parseInt(trufos.getCollectionVariable(key) || '0');
trufos.setCollectionVariable(key, (value + 1).toString());
