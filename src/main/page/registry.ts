import type { Tab } from "../Tab";
import type { ElementSnapshot } from "./types";
import { snapshotPage } from "./actions";
import { formatSnapshot } from "./observer";

export class ElementRegistry {
  private elements: ElementSnapshot[] = [];

  async observe(tab: Tab): Promise<string> {
    const snapshot = await snapshotPage(tab);
    this.elements = snapshot.elements;
    return formatSnapshot(snapshot);
  }

  nodeIdFor(index: number): number | undefined {
    return this.elements.find((element) => element.index === index)?.backendNodeId;
  }
}
