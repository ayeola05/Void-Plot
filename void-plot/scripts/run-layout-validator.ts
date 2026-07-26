import { validateResponsiveGameLayoutFoundation } from "../src/rendering/ResponsiveGameLayout";
import { validateWorldDecorationFoundation } from "../src/rendering/WorldDecorationLayer";
import { validateVisualClarityUiFoundation } from "../src/ui/presentationLayout";

const results = [validateResponsiveGameLayoutFoundation(), validateWorldDecorationFoundation(), validateVisualClarityUiFoundation()];
const errors = results.flatMap((result) => result.errors);
if (errors.length > 0) throw new Error(`Visual layout validation failed:\n${errors.join("\n")}`);
console.log("Visual layout validators passed: responsive matrix, terrain determinism, panel states, tooltip bounds");
