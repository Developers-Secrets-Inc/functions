export const getMemory = () => {
  return "Example getMemory";
};

export const addMemory = (memory: string) => {
  return "Example addMemory";
};

export const help = () => {
  return {
    getMemory: 'A function to get all you memory',
    addMemory: '(memory: string): A function to add a new memory'
  }
}

const [command, ...args] = process.argv.slice(2);

const commands = {
  getMemory,
  addMemory,
  help
};

const main = () => {
  const fn = commands[command as keyof typeof commands];

  if (!fn) {
    console.error(`Commande inconnue : ${command}`);
    process.exit(1);
  }

  const result = (fn as (...args: any[]) => any)(...args);
  console.log(result);
}

main();
