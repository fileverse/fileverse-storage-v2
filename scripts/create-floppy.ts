// create a floppy with the following details
import Floppy from "../src/infra/database/models/floppy.ts";

const data = [];

const createFloppy = async () => {
  for (const item of data) {
    const floppy = await new Floppy(item).save();
    console.log(floppy);
  }
};

createFloppy()
  .then(() => {
    console.log("Floppy created");
  })
  .catch(console.error);
