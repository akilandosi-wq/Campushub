/* CampusHub Supabase compatibility layer.
 * Uses Supabase Auth, PostgreSQL JSONB documents and private Storage.
 * The compatibility surface keeps the existing UI stable during migration.
 */
const SUPABASE_URL = "https://sjczautqlvdhdulweaag.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gi24oDiNH4kRUZIDWI-7_Q_NKa8K6CF";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const auth = {
  Auth: { Persistence: { LOCAL: "local", SESSION: "session" } },
  setPersistence: async () => {},
  createUserWithEmailAndPassword: async (email, password) => {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    return { user: wrapUser(data.user) };
  },
  signInWithEmailAndPassword: async (email, password) => {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { user: wrapUser(data.user) };
  },
  sendPasswordResetEmail: async email => {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw error;
  },
  signOut: async () => { const { error } = await sb.auth.signOut(); if (error) throw error; },
  onAuthStateChanged: callback => {
    sb.auth.getSession().then(({ data }) => callback(data.session ? wrapUser(data.session.user) : null));
    const { data } = sb.auth.onAuthStateChange((_event, session) => callback(session ? wrapUser(session.user) : null));
    return () => data.subscription.unsubscribe();
  },
  getRedirectResult: async () => null
};
function wrapUser(user) {
  if (!user) return null;
  return {
    uid: user.id, email: user.email || "",
    providerData: (user.app_metadata && user.app_metadata.providers || []).map(providerId => ({ providerId })),
    linkWithPopup: async () => { throw new Error("Account linking is not supported during the Supabase migration. Add the public profile link manually."); },
    linkWithRedirect: async () => { throw new Error("Account linking is not supported during the Supabase migration."); },
    unlink: async () => ({ user: wrapUser(user) })
  };
}
function providerStub() { return function Provider() {}; }
const firebase = {
  auth: Object.assign(() => auth, {
    Auth: auth.Auth,
    GoogleAuthProvider: providerStub(), FacebookAuthProvider: providerStub(),
    GithubAuthProvider: providerStub(), TwitterAuthProvider: providerStub(),
    OAuthProvider: providerStub()
  }),
  firestore: { FieldValue: {
    serverTimestamp: () => new Date().toISOString(),
    delete: () => ({ __campushubDelete: true })
  } },
  storage: () => ({
    ref: path => ({
      put: async (file, options) => {
        const { data, error } = await sb.storage.from("campushub-notes").upload(path, file, {
          contentType: options && options.contentType || file.type || "application/pdf",
          upsert: false
        });
        if (error) throw error;
        return { ref: { fullPath: data.path, delete: async () => {
          const result = await sb.storage.from("campushub-notes").remove([data.path]);
          if (result.error) throw result.error;
        } } };
      },
      getDownloadURL: async () => {
        const { data, error } = await sb.storage.from("campushub-notes").createSignedUrl(path, 300);
        if (error) throw error;
        return data.signedUrl;
      },
      delete: async () => {
        const { error } = await sb.storage.from("campushub-notes").remove([path]);
        if (error) throw error;
      }
    })
  })
};
class Snapshot {
  constructor(row) { this.id = row.id; this.exists = !!row; this._data = row ? row.data : undefined; }
  data() { return this._data; }
}
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function applyUpdate(target, patch) {
  const out = clone(target || {});
  Object.entries(patch || {}).forEach(([key, value]) => {
    const parts = key.split(".");
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]] ||= {};
    if (value && value.__campushubDelete) delete cur[parts[parts.length - 1]];
    else cur[parts[parts.length - 1]] = clone(value);
  });
  return out;
}
class Query {
  constructor(name, id) { this.name = name; this.id = id || null; this.filters = []; this.max = null; this.sort = null; this.last = false; }
  where(field, op, value) { const q = this.copy(); q.filters.push({ field, op, value }); return q; }
  limit(n) { const q = this.copy(); q.max = n; return q; }
  orderBy(field, direction) { const q = this.copy(); q.sort = { field, direction: direction || "asc" }; return q; }
  limitToLast(n) { const q = this.copy(); q.max = n; q.last = true; return q; }
  onSnapshot(callback, onError) {
    let active = true;
    const refresh = async () => { try { const snap = await this.get(); if (active) callback(snap); } catch (e) { if (active && onError) onError(e); } };
    refresh();
    const channel = sb.channel("campushub-" + this.name + "-" + crypto.randomUUID())
      .on("postgres_changes", { event: "*", schema: "public", table: "campushub_documents", filter: "collection_name=eq." + this.name }, refresh)
      .subscribe();
    return () => { active = false; sb.removeChannel(channel); };
  }
  copy() { const q = new Query(this.name, this.id); q.filters = this.filters.slice(); q.max = this.max; q.sort = this.sort; q.last = this.last; return q; }
  doc(id) { return new DocumentRef(this.name, id); }
  async get() {
    let request = sb.from("campushub_documents").select("id,data").eq("collection_name", this.name);
    if (this.id) request = request.eq("id", this.id);
    const { data, error } = await request;
    if (error) throw error;
    let rows = (data || []).filter(row => this.filters.every(f => {
      const actual = f.field.split(".").reduce((v, k) => v == null ? undefined : v[k], row.data);
      return f.op === "in" ? f.value.includes(actual) : f.op === "!=" ? actual !== f.value : actual === f.value;
    }));
    if (this.sort) {
      const { field, direction } = this.sort;
      rows.sort((a, b) => {
        const av = field.split(".").reduce((v,k)=>v==null?undefined:v[k],a.data);
        const bv = field.split(".").reduce((v,k)=>v==null?undefined:v[k],b.data);
        return (av > bv ? 1 : av < bv ? -1 : 0) * (direction === "desc" ? -1 : 1);
      });
    }
    if (this.max != null) rows = this.last ? rows.slice(-this.max) : rows.slice(0, this.max);
    const docs = rows.map(row => new Snapshot(row));
    return { docs, size: docs.length, empty: !docs.length, forEach: fn => docs.forEach(fn) };
  }
  async add(value) {
    const id = crypto.randomUUID();
    const { error } = await sb.from("campushub_documents").insert({ collection_name: this.name, id, data: clone(value) });
    if (error) throw error;
    return { id };
  }
  async set(value, options) { return this.doc(this.id || crypto.randomUUID()).set(value, options); }
  async update(value) { return this.doc(this.id).update(value); }
  async delete() { return this.doc(this.id).delete(); }
}
class DocumentRef extends Query {
  constructor(name, id) { super(name, id); }
  collection(child) { return new Query(this.name + "/" + this.id + "/" + child); }
  async get() {
    const { data, error } = await sb.from("campushub_documents").select("id,data").eq("collection_name", this.name).eq("id", this.id).maybeSingle();
    if (error) throw error;
    return new Snapshot(data);
  }
  async set(value, options) {
    const current = options && options.merge ? await this.get() : null;
    const payload = current && current.exists ? applyUpdate(current.data(), value) : clone(value);
    const { error } = await sb.from("campushub_documents").upsert({ collection_name: this.name, id: this.id, data: payload }, { onConflict: "collection_name,id" });
    if (error) throw error;
  }
  async update(value) {
    const current = await this.get();
    if (!current.exists) throw new Error("Record not found.");
    const { error } = await sb.from("campushub_documents").update({ data: applyUpdate(current.data(), value) }).eq("collection_name", this.name).eq("id", this.id);
    if (error) throw error;
  }
  async delete() {
    const { error } = await sb.from("campushub_documents").delete().eq("collection_name", this.name).eq("id", this.id);
    if (error) throw error;
  }
}
const db = {
  collection: name => new Query(name),
  batch: () => {
    const actions = [];
    return {
      set: (ref, value, options) => actions.push(() => ref.set(value, options)),
      delete: ref => actions.push(() => ref.delete()),
      commit: async () => { for (const action of actions) await action(); }
    };
  }
};
