import { hashPod, computeNamespace } from "../utils";
import { slackGetPlainText } from "../../components/MySlate";

export function addPod(state, action) {
  let { parent, index, id } = action.payload;
  if (!parent) {
    parent = "ROOT";
  }
  // update all other siblings' index
  // FIXME this might cause other pods to be re-rendered
  const pod = {
    content: "",
    column: 1,
    result: "",
    stdout: "",
    error: null,
    lang: "python",
    raw: false,
    fold: false,
    thundar: false,
    utility: false,
    name: "",
    exports: {},
    imports: {},
    midports: {},
    isSyncing: false,
    lastPosUpdate: Date.now(),
    children: [],
    io: {},
    ...action.payload,
  };
  // compute the remotehash
  pod.remoteHash = hashPod(pod);
  state.pods[id] = pod;
  // push this node
  // TODO the children no longer need to be ordered
  // TODO the frontend should handle differently for the children
  // state.pods[parent].children.splice(index, 0, id);
  state.pods[parent].children.splice(index, 0, { id, type: pod.type });
  // DEBUG sort-in-place
  // TODO I can probably insert
  // CAUTION the sort expects -1,0,1, not true/false
  pod.ns = computeNamespace(state.pods, id);
}

export function deletePod(state, action) {
  const { id, toDelete } = action.payload;
  // delete the link to parent
  const parent = state.pods[state.pods[id].parent];
  const index = parent.children.map(({ id }) => id).indexOf(id);

  // update all other siblings' index
  // remove all
  parent.children.splice(index, 1);
  toDelete.forEach((id) => {
    delete state.pods[id];
  });
}

export function pastePod(state, action) {
  let { parent, index, column, id } = action.payload;
  let pod = state.pods[id];
  // 1. remove the clipped pod
  let oldparent = state.pods[pod.parent];
  let oldindex = oldparent.children.map(({ id }) => id).indexOf(pod.id);
  if (oldindex == -1) {
    throw new Error("Pod not found", pod.id);
  }
  oldparent.children.splice(oldindex, 1);
  if (oldparent.id === parent && index > oldindex) {
    index -= 1;
  }
  // 2. insert into the new position
  let newparent = state.pods[parent];
  newparent.children.splice(index, 0, { id: pod.id, type: pod.type });
  // 3. set the data of the pod itself
  pod.parent = parent;
  pod.column = column;
  // 4. update namespace
  function helper(node) {
    node.ns = computeNamespace(state.pods, node.id);
    node.children.forEach(({ id }) => {
      helper(state.pods[id]);
    });
  }
  helper(pod);
  // remove it from clipboard
  pod.clipped = false;
  pod.lastclip = true;
}

function setPodType(state, action) {
  const { id, type } = action.payload;
  let pod = state.pods[id];
  if (type === "WYSIWYG" && typeof pod.content === "string") {
    pod.content = [
      {
        type: "paragraph",
        children: [
          {
            text: pod.content,
          },
        ],
      },
    ];
  }
  if (type === "CODE" && Array.isArray(pod.content)) {
    console.log("Converting to code, this will lose styles");
    pod.content = slackGetPlainText(pod.content);
  }
  pod.type = type;
  pod.dirty = pod.remoteHash !== hashPod(pod);
}

export default {
  addPod,
  deletePod,
  pastePod,
  setPodType,
  toggleFold: (state, action) => {
    let id = action.payload;
    let pod = state.pods[id];
    if (!pod.fold) {
      // adapter for adding fold field
      pod.fold = true;
    } else {
      pod.fold = !pod.fold;
    }
    pod.dirty = pod.remoteHash !== hashPod(pod);
  },
  foldAll: (state, action) => {
    for (const [id, pod] of Object.entries(state.pods)) {
      if (pod) {
        pod.fold = true;
        pod.dirty = pod.remoteHash !== hashPod(pod);
      }
    }
  },
  unfoldAll: (state, action) => {
    for (const [id, pod] of Object.entries(state.pods)) {
      pod.fold = false;
      pod.dirty = pod.remoteHash !== hashPod(pod);
    }
  },
  toggleThundar: (state, action) => {
    let id = action.payload;
    let pod = state.pods[id];
    if (!pod.thundar) {
      pod.thundar = true;
    } else {
      pod.thundar = !pod.thundar;
    }
    pod.dirty = pod.remoteHash !== hashPod(pod);
  },
  toggleUtility: (state, action) => {
    let id = action.payload;
    let pod = state.pods[id];
    if (!pod.utility) {
      pod.utility = true;
    } else {
      pod.utility = !pod.utility;
    }
    pod.dirty = pod.remoteHash !== hashPod(pod);
  },
  setName: (state, action) => {
    let { id, name } = action.payload;
    let pod = state.pods[id];
    pod.name = name;
    pod.dirty = pod.remoteHash !== hashPod(pod);
  },
  setPodLang: (state, action) => {
    const { id, lang } = action.payload;
    let pod = state.pods[id];
    pod.lang = lang;
    pod.dirty = pod.remoteHash !== hashPod(pod);
  },
  setPodContent: (state, action) => {
    const { id, content } = action.payload;
    let pod = state.pods[id];
    pod.content = content;
    pod.dirty = pod.remoteHash !== hashPod(pod);
  },
};
