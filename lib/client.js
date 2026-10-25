window.__ModuleLoader__.load({
	id: "dsh-model-groups",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let _deepseek_ai_cordis = require("@deepseek-ai/cordis");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let react_dom = require("react-dom");
		//#region ../../util/values/src/partial-json.ts
		/**
		* Lazily scanned view of one JSON object's top-level fields, built from text
		* that may still be streaming or from an already parsed object. Nothing is
		* scanned until a reader asks; the view remembers every question it answered
		* and reports changed answers when the owner refreshes for publication.
		* Used for model tool-call arguments: a row reads the fields it
		* cares about at whatever granularity it displays, at every stage of the call.
		* @module @deepseek-ai/dsh-util-values/src/partial-json
		*/
		const SIMPLE_ESCAPES = {
			"\"": "\"",
			"\\": "\\",
			"/": "/",
			b: "\b",
			f: "\f",
			n: "\n",
			r: "\r",
			t: "	"
		};
		const CONTENT_ESCAPE = /[\\\u0000-\u001f]/u;
		function isWhitespace(c) {
			return c === " " || c === "\n" || c === "\r" || c === "	";
		}
		function isHex(c) {
			return c >= "0" && c <= "9" || c >= "a" && c <= "f" || c >= "A" && c <= "F";
		}
		(class PartialArguments {
			/** The view of a call with no arguments available. */
			static EMPTY = PartialArguments.fromObject({});
			/**
			* View finished argument text without scanning it until a reader asks.
			* @param text - the complete argument JSON text.
			* @returns a sealed view.
			*/
			static fromText(text) {
				const view = new PartialArguments();
				view.append(text);
				view.sealed = true;
				return view;
			}
			/**
			* View an already parsed argument payload, such as a PTC dispatch object.
			* @param value - the parsed argument value.
			* @returns a sealed view; a non-object payload has no fields.
			*/
			static fromObject(value) {
				const view = new PartialArguments();
				view.object = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
				view.sealed = true;
				return view;
			}
			/**
			* The source: text so far or a parsed object, plus whether it can still grow.
			* These are the only enumerable fields, so two views over the same source
			* compare equal structurally however far each has been read.
			*/
			chunks = [];
			object;
			sealed = false;
			#ends = [];
			#size = 0;
			#consumed = 0;
			#mode = "root";
			#escape = false;
			#keyStart = 0;
			#keyEscaped = false;
			#key = "";
			#current = null;
			#nestedEnds = [];
			#nestedInString = false;
			#invalidAt;
			#invalidValue = false;
			#entries = /* @__PURE__ */ new Map();
			#order = [];
			#reads = /* @__PURE__ */ new Map();
			/** Whether this view rejects further appends; does not scan text or register reads. */
			get isSealed() {
				return this.sealed;
			}
			/** Whether indexing or a content read found invalid JSON; unread value contents are not validated. */
			get invalid() {
				this.scan();
				return this.#mode === "invalid" || this.#invalidValue;
			}
			/**
			* Retain streamed argument text without scanning or comparing observed answers.
			* @param fragment - the text following every fragment appended before.
			*/
			append(fragment) {
				if (this.sealed) throw new Error("PartialArguments: cannot append to a sealed view");
				if (fragment.length === 0) return;
				this.chunks.push(fragment);
				this.#size += fragment.length;
				this.#ends.push(this.#size);
			}
			/**
			* Reconcile a streamed prefix with authoritative complete text without joining the fragments.
			* @param text - the final argument text, which replaces missing or conflicting deltas.
			* @returns this view sealed with its caches retained when every character matches; otherwise a new sealed view.
			*/
			settle(text) {
				if (this.object !== void 0 || text.length !== this.#size) return PartialArguments.fromText(text);
				let offset = 0;
				for (const chunk of this.chunks) {
					if (!text.startsWith(chunk, offset)) return PartialArguments.fromText(text);
					offset += chunk.length;
				}
				this.chunks = text.length === 0 ? [] : [text];
				this.#ends = text.length === 0 ? [] : [text.length];
				this.sealed = true;
				return this;
			}
			/**
			* Compare observed answers and advance their publication baseline. Unread views remain unscanned.
			* @returns whether any observed answer changed since its first read or the preceding refresh.
			*/
			refresh() {
				if (this.#reads.size === 0) return false;
				this.scan();
				let changed = false;
				let completions = false;
				for (const read of this.#reads.values()) {
					if (read.completion) {
						completions = true;
						continue;
					}
					changed = this.refreshRead(read) || changed;
				}
				if (completions) {
					for (const read of this.#reads.values()) if (read.completion) changed = this.refreshRead(read) || changed;
				}
				if (this.sealed) this.#reads.clear();
				return changed;
			}
			refreshRead(read) {
				const now = read.answer();
				if (Object.is(now, read.last)) return false;
				read.last = now;
				return true;
			}
			/**
			* Check whether no further fields can arrive.
			* @returns whether the outer object closed, indexing failed, or the view is sealed; unread values are not validated.
			*/
			closed() {
				return this.remember("closed", "", () => this.closedNow());
			}
			/**
			* List discovered fields in first-appearance order.
			* @returns top-level keys seen so far, in first-appearance order.
			*/
			keys() {
				return this.remember("keys", "", () => this.keysNow(), (keys) => keys.length);
			}
			/**
			* Check whether a top-level field has appeared.
			* @param key - argument name.
			* @returns whether the field has appeared (a string opened or another value began).
			*/
			has(key) {
				return this.remember("has", key, () => this.hasNow(key));
			}
			/**
			* Check whether a field's closing delimiter has arrived, without validating its contents.
			* @param key - argument name.
			* @returns whether its delimiter arrived and no content reader has reported an error for this value.
			*/
			complete(key) {
				return this.remember("complete", key, () => this.completeNow(key));
			}
			/**
			* Read string length without materializing its text.
			* @param key - argument name.
			* @param options - change granularity for a streaming string.
			* @returns decoded UTF-16 length of the string field so far; undefined when absent or not a string.
			*/
			stringLength(key, options) {
				const step = Math.max(1, Math.floor(options?.step ?? 1));
				const offset = options?.offset ?? 0;
				return this.remember(`length:${step}:${offset}`, key, () => this.lengthNow(key), (length) => length === void 0 ? void 0 : Math.ceil((length + offset) / step));
			}
			/**
			* Check a string against a decoded UTF-16 length limit without materializing it.
			* @param key - argument name.
			* @param maxLength - decoded UTF-16 limit, floored to at least zero.
			* @returns whether the string is longer than the limit; false when absent or not a string.
			*/
			stringExceeds(key, maxLength) {
				const limit = Math.max(0, Math.floor(maxLength));
				return this.remember(`exceeds:${limit}`, key, () => (this.lengthNow(key, limit + 1) ?? 0) > limit);
			}
			/**
			* Read a decoded string, including a streaming prefix.
			* @param key - argument name.
			* @returns the string field's decoded text so far; undefined when absent or not a string.
			*/
			text(key) {
				return this.remember("text", key, () => this.textNow(key));
			}
			/**
			* Read at most the first decoded UTF-16 units of a string.
			* @param key - argument name.
			* @param maxLength - maximum decoded UTF-16 length, floored to at least one.
			* @returns the bounded string prefix; undefined when absent or not a string.
			*/
			textPrefix(key, maxLength) {
				const limit = Math.max(1, Math.floor(maxLength));
				return this.remember(`prefix:${limit}`, key, () => this.textPrefixNow(key, limit));
			}
			/**
			* Read a completed non-string argument.
			* @param key - argument name.
			* @returns the parsed non-string value once it closed; undefined while open, absent, or a string.
			*/
			value(key) {
				return this.remember("value", key, () => this.valueNow(key));
			}
			/** Answer a question and, on a streaming view, remember it for change detection. */
			remember(kind, key, read, comparison) {
				this.scan();
				const result = read();
				if (!this.sealed) {
					const id = `${kind}/${key}`;
					if (!this.#reads.has(id)) this.#reads.set(id, {
						completion: kind === "complete",
						answer: comparison === void 0 ? read : () => comparison(read()),
						last: comparison === void 0 ? result : comparison(result)
					});
				}
				return result;
			}
			closedNow() {
				return this.sealed || this.#mode === "closed" || this.#mode === "invalid";
			}
			keysNow() {
				return this.object === void 0 ? this.#order : Object.keys(this.object);
			}
			hasNow(key) {
				return this.object === void 0 ? this.#entries.has(key) : Object.hasOwn(this.object, key);
			}
			completeNow(key) {
				if (this.object !== void 0) return Object.hasOwn(this.object, key);
				const entry = this.#entries.get(key);
				return entry !== void 0 && entry.end >= 0 && (entry.kind === "string" ? entry.invalidAt === void 0 : !entry.invalid);
			}
			lengthNow(key, limit = Number.POSITIVE_INFINITY) {
				if (this.object !== void 0) {
					const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
					return typeof field === "string" ? field.length : void 0;
				}
				const entry = this.#entries.get(key);
				if (entry?.kind !== "string") return void 0;
				if (entry.text !== void 0 && entry.text.at === entry.end) return entry.text.length;
				const read = entry.length ??= {
					at: entry.start,
					length: 0,
					text: ""
				};
				this.readString(entry, read, limit, false);
				return read.length;
			}
			textNow(key) {
				if (this.object !== void 0) {
					const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
					return typeof field === "string" ? field : void 0;
				}
				const entry = this.#entries.get(key);
				if (entry?.kind !== "string") return void 0;
				if (entry.text === void 0 && entry.end >= 0 && entry.needsDecoding && entry.invalidAt === void 0) {
					let text;
					try {
						text = JSON.parse(`"${this.slice(entry.start, entry.end)}"`);
					} catch (_error) {}
					if (text !== void 0) entry.text = {
						at: entry.end,
						length: text.length,
						text
					};
				}
				const read = entry.text ??= {
					at: entry.start,
					length: 0,
					text: ""
				};
				this.readString(entry, read, Number.POSITIVE_INFINITY, true);
				return read.text;
			}
			textPrefixNow(key, maxLength) {
				if (this.object !== void 0) {
					const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
					return typeof field === "string" ? field.slice(0, maxLength) : void 0;
				}
				const entry = this.#entries.get(key);
				if (entry?.kind !== "string") return void 0;
				const prefixes = entry.prefixes ??= /* @__PURE__ */ new Map();
				let read = prefixes.get(maxLength);
				if (read === void 0) {
					read = {
						at: entry.start,
						length: 0,
						text: ""
					};
					prefixes.set(maxLength, read);
				}
				this.readString(entry, read, maxLength, true);
				return read.text;
			}
			valueNow(key) {
				if (this.object !== void 0) {
					if (!Object.hasOwn(this.object, key)) return void 0;
					const field = this.object[key];
					return typeof field === "string" ? void 0 : field;
				}
				const entry = this.#entries.get(key);
				if (entry?.kind !== "value" || entry.end < 0 || entry.invalid) return void 0;
				if (entry.parsed === void 0) try {
					entry.parsed = JSON.parse(this.slice(entry.start, entry.end));
				} catch (_error) {
					entry.invalid = true;
					this.#invalidValue = true;
				}
				return entry.parsed;
			}
			chunkAt(at) {
				let low = 0;
				let high = this.#ends.length;
				while (low < high) {
					const mid = low + high >>> 1;
					if (this.#ends[mid] <= at) low = mid + 1;
					else high = mid;
				}
				return low;
			}
			/** Materialize only a requested range, never the cumulative source. */
			slice(start, end) {
				if (start >= end) return "";
				const first = this.chunkAt(start);
				const last = this.chunkAt(end - 1);
				const base = first === 0 ? 0 : this.#ends[first - 1];
				if (first === last) return this.chunks[first].slice(start - base, end - base);
				const parts = [this.chunks[first].slice(start - base)];
				for (let i = first + 1; i < last; i++) parts.push(this.chunks[i]);
				parts.push(this.chunks[last].slice(0, end - this.#ends[last - 1]));
				return parts.join("");
			}
			readString(entry, read, limit, materialize) {
				const end = Math.min(entry.end < 0 ? this.#consumed : entry.end, entry.invalidAt ?? Number.POSITIVE_INFINITY, this.#invalidAt ?? Number.POSITIVE_INFINITY);
				if (!entry.needsDecoding) {
					const length = Math.min(end - read.at, limit - read.length);
					if (length <= 0) return;
					if (materialize) read.text += this.slice(read.at, read.at + length);
					read.at += length;
					read.length += length;
					return;
				}
				let chunkIndex = this.chunkAt(read.at);
				while (read.at < end && read.length < limit) {
					const base = chunkIndex === 0 ? 0 : this.#ends[chunkIndex - 1];
					const chunk = this.chunks[chunkIndex];
					const remaining = chunk.slice(read.at - base, Math.min(chunk.length, end - base));
					const boundary = remaining.search(CONTENT_ESCAPE);
					const length = Math.min(boundary < 0 ? remaining.length : boundary, limit - read.length);
					if (length > 0) {
						if (materialize) read.text += remaining.slice(0, length);
						read.at += length;
						read.length += length;
						if (read.at === base + chunk.length) chunkIndex++;
						continue;
					}
					const type = remaining.length > 1 ? remaining[1] : read.at + 1 < end ? this.chunks[chunkIndex + 1][0] : void 0;
					let decoded;
					let width = 2;
					if (remaining[0] === "\\" && type === void 0 && entry.end < 0) return;
					if (remaining[0] === "\\" && type === "u") {
						const hex = this.slice(read.at + 2, Math.min(end, read.at + 6));
						let valid = true;
						for (let i = 0; i < hex.length; i++) if (!isHex(hex[i])) valid = false;
						if (valid) {
							if (hex.length < 4 && entry.end < 0) return;
							if (hex.length === 4) decoded = String.fromCharCode(Number.parseInt(hex, 16));
						}
						width = 6;
					} else if (remaining[0] === "\\" && type !== void 0) decoded = SIMPLE_ESCAPES[type];
					if (decoded === void 0) {
						entry.invalidAt = read.at;
						this.#invalidValue = true;
						return;
					}
					if (materialize) read.text += decoded;
					read.length++;
					read.at += width;
					while (chunkIndex < this.chunks.length && read.at >= this.#ends[chunkIndex]) chunkIndex++;
				}
			}
			/** Locate new field ranges without decoding or parsing their contents. */
			scan() {
				if (this.object !== void 0 || this.#consumed === this.#size) return;
				for (let i = this.chunkAt(this.#consumed); i < this.chunks.length && this.#invalidAt === void 0; i++) {
					const pending = this.chunks[i];
					const base = i === 0 ? 0 : this.#ends[i - 1];
					for (let index = this.#consumed - base; index < pending.length && this.#mode !== "invalid"; index++) {
						if (this.#mode === "string" || this.#mode === "nested" && this.#nestedInString) {
							const end = this.stringBoundary(pending, index);
							this.#consumed += end - index;
							index = end;
							if (index === pending.length) break;
						}
						this.step(pending[index], this.#consumed);
						this.#consumed++;
					}
				}
			}
			/** Only raw quotes and their preceding backslash runs can terminate a string. */
			stringBoundary(fragment, start) {
				let at = start;
				while (true) {
					const quote = fragment.indexOf("\"", at);
					const end = quote < 0 ? fragment.length : quote;
					if (this.#mode === "string") {
						const entry = this.#current;
						if (!entry.needsDecoding && CONTENT_ESCAPE.test(fragment.slice(at, end))) entry.needsDecoding = true;
					}
					let slashStart = end;
					while (slashStart > at && fragment[slashStart - 1] === "\\") slashStart--;
					const escaped = (end - slashStart) % 2 === 1 !== (slashStart === at && this.#escape);
					this.#escape = quote < 0 && escaped;
					if (quote < 0 || !escaped) return end;
					at = quote + 1;
				}
			}
			step(c, at) {
				switch (this.#mode) {
					case "root":
						if (isWhitespace(c)) return;
						if (c === "{") {
							this.#mode = "key-or-end";
							return;
						}
						this.fail();
						return;
					case "key-or-end":
						if (isWhitespace(c)) return;
						if (c === "}") {
							this.#mode = "closed";
							return;
						}
						if (c === "\"") {
							this.beginKey(at);
							return;
						}
						this.fail();
						return;
					case "key-only":
						if (isWhitespace(c)) return;
						if (c === "\"") {
							this.beginKey(at);
							return;
						}
						this.fail();
						return;
					case "key":
						this.stepKey(c, at);
						return;
					case "colon":
						if (isWhitespace(c)) return;
						if (c === ":") {
							this.#mode = "value";
							return;
						}
						this.fail();
						return;
					case "value":
						this.beginValue(c, at);
						return;
					case "string": {
						const entry = this.#current;
						entry.end = at;
						this.#current = null;
						this.#mode = "comma-or-end";
						return;
					}
					case "scalar":
						this.stepScalar(c, at);
						return;
					case "nested":
						this.stepNested(c, at);
						return;
					case "comma-or-end":
						if (isWhitespace(c)) return;
						if (c === ",") {
							this.#mode = "key-only";
							return;
						}
						if (c === "}") {
							this.#mode = "closed";
							return;
						}
						this.fail();
						return;
					case "closed":
						if (isWhitespace(c)) return;
						this.fail();
						return;
					/* v8 ignore next 2 -- scan() stops stepping once the view is invalid. */
					case "invalid": return;
					/* v8 ignore next 2 -- Every scanner mode has a handler above. */
					default: assertNever(this.#mode);
				}
			}
			fail() {
				this.#invalidAt = this.#consumed;
				this.#mode = "invalid";
				this.#current = null;
			}
			beginKey(at) {
				this.#mode = "key";
				this.#keyStart = at + 1;
				this.#keyEscaped = false;
				this.#escape = false;
			}
			stepKey(c, at) {
				if (c < " ") {
					this.fail();
					return;
				}
				if (this.#escape) {
					this.#escape = false;
					return;
				}
				if (c === "\\") {
					this.#escape = true;
					this.#keyEscaped = true;
					return;
				}
				if (c !== "\"") return;
				const raw = this.slice(this.#keyStart, at);
				if (this.#keyEscaped) try {
					this.#key = JSON.parse(`"${raw}"`);
				} catch (_error) {
					this.fail();
					return;
				}
				else this.#key = raw;
				this.#mode = "colon";
			}
			open(entry) {
				if (!this.#entries.has(this.#key)) this.#order.push(this.#key);
				this.#entries.set(this.#key, entry);
				this.#current = entry;
			}
			beginValue(c, at) {
				if (isWhitespace(c)) return;
				if (c === "\"") {
					this.open({
						kind: "string",
						start: at + 1,
						end: -1,
						needsDecoding: false,
						invalidAt: void 0,
						length: void 0,
						text: void 0,
						prefixes: void 0
					});
					this.#escape = false;
					this.#mode = "string";
					return;
				}
				if (c === "}" || c === "," || c === ":" || c === "]") {
					this.fail();
					return;
				}
				this.open({
					kind: "value",
					start: at,
					end: -1,
					parsed: void 0,
					invalid: false
				});
				if (c === "{" || c === "[") {
					this.#mode = "nested";
					this.#nestedEnds = [c === "{" ? "}" : "]"];
					this.#nestedInString = false;
					this.#escape = false;
					return;
				}
				this.#mode = "scalar";
			}
			stepScalar(c, at) {
				if (c !== "," && c !== "}" && !isWhitespace(c)) return;
				this.closeValue(at);
				this.#mode = c === "," ? "key-only" : c === "}" ? "closed" : "comma-or-end";
			}
			stepNested(c, at) {
				if (this.#nestedInString) {
					this.#nestedInString = false;
					return;
				}
				if (c === "\"") {
					this.#nestedInString = true;
					return;
				}
				if (c === "{" || c === "[") {
					this.#nestedEnds.push(c === "{" ? "}" : "]");
					return;
				}
				if (c === "}" || c === "]") {
					if (this.#nestedEnds.pop() !== c) {
						this.fail();
						return;
					}
					if (this.#nestedEnds.length === 0) {
						this.closeValue(at + 1);
						this.#mode = "comma-or-end";
					}
				}
			}
			closeValue(end) {
				const entry = this.#current;
				entry.end = end;
				this.#current = null;
			}
		});
		//#endregion
		//#region ../../util/values/src/index.ts
		/**
		* Mark an unreachable closed-union branch.
		* @param value - impossible value; an unhandled typed variant fails at the call site.
		* @param context - optional switch-site label included in the failure message.
		* @returns never; a runtime value that escaped its type always throws.
		*/
		function assertNever(value, context) {
			const rendered = JSON.stringify(value) ?? String(value);
			throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
		}
		/**
		* Weak-key lookup with a strongly retained iterable set of associated values.
		*
		* Each value must belong to only one key. The container performs no automatic
		* cleanup; owners delete associations or clear the container at lifecycle end.
		*/
		var WeakMapWithValues = class {
			keys = /* @__PURE__ */ new WeakMap();
			valueSet = /* @__PURE__ */ new Set();
			/** Live strongly retained values in insertion order. */
			values = this.valueSet;
			/**
			* Read the value associated with a key.
			* @param key - weakly held lookup key.
			* @returns the associated value, or absence.
			*/
			get(key) {
				return this.keys.get(key);
			}
			/**
			* Test whether a key has an association.
			* @param key - weakly held lookup key.
			* @returns whether the key is present.
			*/
			has(key) {
				return this.keys.has(key);
			}
			/**
			* Associate one key with one caller-unique value.
			* @param key - weakly held lookup key.
			* @param value - strongly retained value that belongs to no other key.
			* @returns this container.
			*/
			set(key, value) {
				if (this.keys.has(key)) {
					const previous = this.keys.get(key);
					if (previous === value) return this;
					this.valueSet.delete(previous);
				}
				this.keys.set(key, value);
				this.valueSet.add(value);
				return this;
			}
			/**
			* Remove one association and its strongly retained value.
			* @param key - weakly held lookup key.
			* @returns whether an association was removed.
			*/
			delete(key) {
				if (!this.keys.has(key)) return false;
				const value = this.keys.get(key);
				const deleted = this.keys.delete(key);
				this.valueSet.delete(value);
				return deleted;
			}
			/** Remove every association and strongly retained value. */
			clear() {
				this.keys = /* @__PURE__ */ new WeakMap();
				this.valueSet.clear();
			}
		};
		//#endregion
		//#region lib/types/client/catalog.js
		/** One Host-generation model catalog shared by every Session selector. */
		/** Loads at most one model catalog for the current Host generation. */
		var ModelCatalogDirectory = class {
			ctx;
			/** Current shared catalog value and load lifecycle. */
			store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
				value: null,
				status: "idle",
				error: null
			});
			reasoning = /* @__PURE__ */ new Map();
			/**
			* Read the last advertised reasoning metadata, including unavailable models.
			* @param selection - provider and model whose effort is displayed.
			* @returns reasoning metadata observed during this Host generation.
			*/
			reasoningFor(selection) {
				return this.reasoning.get(JSON.stringify([selection.provider, selection.model]));
			}
			generation = 0;
			inflight;
			/**
			* @param ctx - the providing plugin's context, whose `remote.session`
			* namespace carries the Host-generation catalog.
			*/
			constructor(ctx) {
				this.ctx = ctx;
			}
			/**
			* Return the current generation's catalog, sharing its one in-flight load.
			* @returns the loaded global catalog.
			*/
			load() {
				const state = this.store.getSnapshot();
				if (state.status === "ready" && state.value !== null) return Promise.resolve(state.value);
				if (this.inflight !== void 0) return this.inflight;
				const generation = this.generation;
				this.store.update((draft) => {
					draft.status = "loading";
					draft.error = null;
				});
				const operation = this.ctx.remote.session.modelCatalog().then((response) => {
					if (!response.ok) throw new Error(`${response.error.code}: ${response.error.message}`);
					if (generation === this.generation) {
						for (const group of response.value.groups) for (const model of group.models) this.reasoning.set(JSON.stringify([group.id, model.id]), model.reasoning);
						this.store.set({
							value: response.value,
							status: "ready",
							error: null
						});
					}
					return response.value;
				}).catch((error) => {
					if (generation === this.generation) this.store.update((draft) => {
						draft.status = "error";
						draft.error = error instanceof Error ? error.message : String(error);
					});
					throw error;
				}).finally(() => {
					if (generation === this.generation && this.inflight === operation) this.inflight = void 0;
				});
				this.inflight = operation;
				return operation;
			}
			/**
			* Invalidate the loaded catalog; the next explicit menu read reloads it.
			* @param clear - whether values from the previous Host generation must be hidden.
			*/
			invalidate(clear = false) {
				this.generation += 1;
				this.inflight = void 0;
				const value = clear ? null : this.store.getSnapshot().value;
				this.store.set({
					value,
					status: "idle",
					error: null
				});
			}
			/** Invalidate and reload the catalog after a Host-side model input changes. */
			refresh() {
				this.invalidate();
				this.load().catch(() => {});
			}
			/** Clear Host-specific values and load the replacement Host generation. */
			resetGeneration() {
				this.reasoning.clear();
				this.invalidate(true);
				this.load().catch(() => {});
			}
		};
		//#endregion
		//#region lib/types/client/directory.js
		/** One session's shared directory controller; disposed with the session scope. */
		var ModelDirectory = class {
			sessions;
			sessionId;
			available;
			catalog;
			projected;
			isBlank;
			track;
			/** The shared snapshot both entries render from (uSES-safe store). */
			store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
				current: null,
				routable: null,
				groups: [],
				failures: [],
				status: "idle",
				pending: null,
				error: null
			});
			/** Latest selection operation wins; an older response never overwrites a newer one. */
			generation = 0;
			disposed = false;
			unsubscribeCatalog;
			unsubscribeSelection;
			/**
			* @param sessions - the session wire face (captured from the plugin's root connection).
			* @param sessionId - the owning session.
			* @param available - whether this session may use Agent-bound model RPCs.
			* @param catalog - Host-generation catalog shared by every Session.
			* @param projected - durable model selection projected from Session history.
			* @param isBlank - whether this Session has no first message yet.
			* @param track - desktop-only callback after a successful user selection.
			*/
			constructor(sessions, sessionId, available, catalog, projected, isBlank, track) {
				this.sessions = sessions;
				this.sessionId = sessionId;
				this.available = available;
				this.catalog = catalog;
				this.projected = projected;
				this.isBlank = isBlank;
				this.track = track;
				this.unsubscribeCatalog = catalog.store.subscribe(() => {
					this.syncInputs();
				});
				this.unsubscribeSelection = projected.subscribe(() => {
					this.syncInputs();
				});
				this.syncInputs();
			}
			/**
			* Ensure the Host generation's shared available catalog is loaded.
			* @returns the fresh directory value.
			*/
			async load() {
				this.assertAvailable();
				await this.catalog.load();
				this.syncInputs();
				return this.store.getSnapshot();
			}
			/**
			* Select the complete provider/model/reasoning selection. The durable
			* projection frame updates the shared current; failures surface on the store
			* and return with the operation so each entry can present its own failure.
			* @param selection - provider, provider-owned model id, and optional adapter-owned effort.
			* @returns the selection outcome, including the original Remote failure.
			*/
			async select(selection) {
				this.assertAvailable();
				const previous = this.store.getSnapshot().current;
				const previousEffort = previous?.reasoningEffort ?? (previous === null ? void 0 : this.catalog.reasoningFor(previous)?.defaultEffort);
				const nextEffort = selection.reasoningEffort ?? this.catalog.reasoningFor(selection)?.defaultEffort;
				const generation = ++this.generation;
				this.store.update((s) => {
					s.status = "selecting";
					s.pending = selection;
					s.error = null;
				});
				const result = await this.sessions.selectModel({
					sessionId: this.sessionId,
					provider: selection.provider,
					model: selection.model,
					...selection.reasoningEffort === void 0 ? {} : { reasoningEffort: selection.reasoningEffort }
				});
				if (this.disposed || generation !== this.generation) return result.ok ? {
					ok: true,
					value: void 0
				} : result;
				if (!result.ok) {
					this.store.update((s) => {
						s.status = "error";
						s.pending = null;
						s.error = `${result.error.code}: ${result.error.message}`;
					});
					return result;
				}
				if (previous !== null) {
					const from = `${previous.provider}/${previous.model}`;
					const to = `${selection.provider}/${selection.model}`;
					if (from !== to) this.track?.("model_switch", {
						...this.isBlank() ? {} : { session_id: this.sessionId },
						switch_from: from,
						switch_to: to
					});
					if (from === to && previousEffort !== nextEffort) this.track?.("thinking_level_switch", {
						...this.isBlank() ? {} : { session_id: this.sessionId },
						model_name: to,
						switch_from: previousEffort ?? "default",
						switch_to: nextEffort ?? "default"
					});
				}
				this.store.update((s) => {
					s.status = "ready";
					s.pending = null;
					s.error = null;
				});
				this.syncInputs();
				return {
					ok: true,
					value: void 0
				};
			}
			/**
			* Invalidate an in-flight selection response from the previous Host generation.
			*/
			resetConnected() {
				if (this.disposed) return;
				++this.generation;
				this.store.update((state) => {
					if (state.status === "selecting") state.status = "idle";
					state.pending = null;
					state.error = null;
				});
				this.syncInputs();
			}
			/** Scope teardown: late settlements lose write access to the store. */
			dispose() {
				this.disposed = true;
				this.unsubscribeSelection();
				this.unsubscribeCatalog();
			}
			assertAvailable() {
				if (!this.available()) throw new Error("model selection is unavailable for addressed subagent sessions");
			}
			syncInputs() {
				if (this.disposed) return;
				const catalog = this.catalog.store.getSnapshot();
				const projected = modelSelectionProjection(this.projected.getSnapshot());
				const intended = projected?.next ?? catalog.value?.default;
				const reasoning = intended === void 0 ? void 0 : this.catalog.reasoningFor(intended);
				const effort = intended?.reasoningEffort ?? reasoning?.defaultEffort;
				const retainedEffort = effort === void 0 ? void 0 : reasoning?.efforts.find((level) => level.id === effort)?.name ?? effort;
				if (catalog.status !== "ready" || catalog.value === null || projected === void 0) {
					this.store.set({
						current: catalog.value === null ? null : this.store.getSnapshot().current,
						...retainedEffort === void 0 ? {} : { retainedEffort },
						routable: null,
						groups: catalog.value?.groups ?? [],
						failures: catalog.value?.failures ?? [],
						status: catalog.status === "error" ? "error" : "loading",
						pending: this.store.getSnapshot().pending,
						error: catalog.error
					});
					return;
				}
				const selection = projected.next ?? catalog.value.default;
				const routable = catalog.value.groups.some((group) => group.id === selection.provider && group.models.some((model) => model.id === selection.model));
				this.store.set({
					current: selection,
					...retainedEffort === void 0 ? {} : { retainedEffort },
					routable,
					groups: catalog.value.groups,
					failures: catalog.value.failures,
					status: this.store.getSnapshot().status === "selecting" ? "selecting" : "ready",
					pending: this.store.getSnapshot().pending,
					error: null
				});
			}
		};
		function modelSelectionProjection(value) {
			return value === void 0 ? void 0 : value;
		}
		//#endregion
		//#region lib/types/client/service.js
		/** The `ctx.modelDirectories` session model-selection service. */
		var ModelDirectoryResolver = class extends _deepseek_ai_cordis.Service {
			static inject = [
				"sessions",
				"remote",
				"remote.session"
			];
			live = { directories: new WeakMapWithValues() };
			catalog;
			/**
			* @param ctx - owning root context (the service registers itself as `models`).
			*/
			constructor(ctx) {
				super(ctx, "modelDirectories");
				this.catalog = new ModelCatalogDirectory(ctx);
				this.catalog.load().catch(() => {});
				ctx.on("connection/reset", () => {
					this.catalog.resetGeneration();
					for (const directory of this.live.directories.values) directory.resetConnected();
				});
				ctx.remote.$on("llm/adapters-updated", () => {
					this.catalog.refresh();
				});
				ctx.remote.$on("settings/document-updated", () => {
					this.catalog.refresh();
				});
				ctx.remote.$on("credentials/record-updated", () => {
					this.catalog.refresh();
				});
				ctx.remote.$on("credentials/reference-updated", () => {
					this.catalog.refresh();
				});
			}
			/**
			* Resolve the per-session shared directory (lazy; the scope disposer
			* removes and disposes it). Unknown sessions fail loud.
			* @param sessionId - the owning session.
			* @returns the resident directory both entries share.
			*/
			directoryFor(sessionId) {
				const { live } = this;
				const sessions = this.ctx.sessions;
				const actx = sessions.scope(sessionId);
				if (actx === void 0) throw new Error(`ui-model-selection: session "${String(sessionId)}" resolved no scope`);
				const binding = sessions.binding(sessionId);
				if (binding === void 0) throw new Error(`ui-model-selection: session "${String(sessionId)}" resolved no binding`);
				const existing = live.directories.get(binding);
				if (existing !== void 0) return existing;
				const directory = new ModelDirectory(this.ctx.remote.session, sessionId, () => sessions.subagentAddress(sessionId) === void 0, this.catalog, binding.session.projections.faceOf("modelSelection"), () => binding.session.getSnapshot().blank, (name, attributes) => this.ctx.get("productAnalytics")?.track(name, attributes));
				live.directories.set(binding, directory);
				actx.effect(() => () => {
					directory.dispose();
					live.directories.delete(binding);
				}, "ui-model-selection: session directory");
				return directory;
			}
		};
		//#endregion
		//#region ../../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-model-selection/src/client/ModelSelect.module.css.mjs
		const css = "._7KE1Ra_root{min-width:0;position:relative}._7KE1Ra_trigger{border-radius:var(--dsw-radius-sm);min-width:0;max-width:min(360px,45cqw);height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;outline:none;align-items:center;gap:4px;padding:0 4px 0 8px;font-size:13px;font-weight:400;line-height:20px;display:flex}._7KE1Ra_trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}._7KE1Ra_trigger:focus-visible:not([data-selection-focus]){box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}._7KE1Ra_trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}._7KE1Ra_triggerLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}._7KE1Ra_triggerEffort{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-caption);flex-shrink:1000;overflow:hidden}._7KE1Ra_triggerIcon{display:var(--dsh-composer-model-icon-display,none);flex:none}._7KE1Ra_triggerLabel,._7KE1Ra_triggerEffort{display:var(--dsh-composer-model-text-display,block)}._7KE1Ra_chevron{color:var(--dsw-alias-label-caption);flex:none;transition:transform .12s}._7KE1Ra_chevronOpen{transform:rotate(180deg)}._7KE1Ra_menu{z-index:1100;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);width:max-content;min-width:min(240px,100vw - 32px);max-width:min(420px,100vw - 32px);max-height:min(360px,100vh - 96px);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border:0;flex-direction:column;padding:4px;display:flex;position:fixed;overflow:hidden}._7KE1Ra_status,._7KE1Ra_empty{color:var(--dsw-alias-label-tertiary);padding:8px;font-size:12px;line-height:18px}._7KE1Ra_error,._7KE1Ra_warning{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:3px;padding:6px 7px;font-size:11px;line-height:16px;display:flex}._7KE1Ra_warning{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-state-warn-label)}._7KE1Ra_retry{color:inherit;font:inherit;cursor:pointer;background:0 0;border:none;flex:none;padding:0;font-weight:600}._7KE1Ra_searchRow{flex-shrink:0;margin:2px 0 3px;position:relative}._7KE1Ra_searchRow ._7KE1Ra_search{border-radius:var(--dsw-radius-md);background:0 0;border:0 solid #0000;height:auto;padding:5px 7px;display:flex}._7KE1Ra_searchRow ._7KE1Ra_searchWithQuery{padding-right:34px}._7KE1Ra_searchClear{corner-shape:round;width:24px;height:24px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:50%;justify-content:center;align-items:center;padding:0;display:inline-flex;position:absolute;top:50%;right:4px;transform:translateY(-50%)}._7KE1Ra_searchClear:hover,._7KE1Ra_searchClear:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}._7KE1Ra_searchRow ._7KE1Ra_search:focus-within{border-color:#0000}._7KE1Ra_searchRow ._7KE1Ra_search input{padding:0;font-size:12px;line-height:normal}._7KE1Ra_searchRow ._7KE1Ra_search input::placeholder{color:var(--dsw-alias-label-caption)}._7KE1Ra_groups{min-height:0;overflow-y:auto}._7KE1Ra_option{box-sizing:border-box;border-radius:var(--dsw-radius-md);width:auto;min-width:100%;min-height:34px;color:inherit;text-align:left;cursor:pointer;background:0 0;border:none;outline:none;align-items:center;gap:6px;padding:5px 7px;display:flex}._7KE1Ra_option:not(._7KE1Ra_modelOption):hover:not(:disabled),._7KE1Ra_option:focus-visible,._7KE1Ra_optionActive:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}._7KE1Ra_selected{background:0 0}._7KE1Ra_option:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}._7KE1Ra_optionCopy{flex-direction:column;flex:1;min-width:0;display:flex}._7KE1Ra_modelName{color:inherit;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:400;line-height:18px;overflow:hidden}._7KE1Ra_check{color:var(--dsw-alias-label-primary);flex:0 0 14px;place-items:center;display:grid}._7KE1Ra_check svg{width:14px;height:14px}._7KE1Ra_cell{box-sizing:border-box;border-radius:var(--dsw-radius-md);width:auto;min-width:100%;height:34px;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;background:0 0;border:none;outline:none;align-items:center;gap:6px;padding:0 8px;font-size:13px;line-height:20px;display:flex}._7KE1Ra_cell:hover,._7KE1Ra_cell:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}._7KE1Ra_cellLabel{white-space:nowrap;flex:none}._7KE1Ra_cellValue{text-overflow:ellipsis;white-space:nowrap;text-align:right;min-width:0;color:var(--dsw-alias-label-tertiary);flex:auto;overflow:hidden}._7KE1Ra_cellChevron{width:12px;height:12px;color:var(--dsw-alias-menu-icon);flex:none}";
		const tagId = "dsh-model-groups/ModelSelect.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-model-selection";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var ModelSelect_module_css_default = {
			"cell": "_7KE1Ra_cell",
			"cellChevron": "_7KE1Ra_cellChevron",
			"cellLabel": "_7KE1Ra_cellLabel",
			"cellValue": "_7KE1Ra_cellValue",
			"check": "_7KE1Ra_check",
			"chevron": "_7KE1Ra_chevron",
			"chevronOpen": "_7KE1Ra_chevronOpen",
			"empty": "_7KE1Ra_empty",
			"error": "_7KE1Ra_error",
			"groups": "_7KE1Ra_groups",
			"menu": "_7KE1Ra_menu",
			"modelName": "_7KE1Ra_modelName",
			"modelOption": "_7KE1Ra_modelOption",
			"option": "_7KE1Ra_option",
			"optionActive": "_7KE1Ra_optionActive",
			"optionCopy": "_7KE1Ra_optionCopy",
			"retry": "_7KE1Ra_retry",
			"root": "_7KE1Ra_root",
			"search": "_7KE1Ra_search",
			"searchClear": "_7KE1Ra_searchClear",
			"searchRow": "_7KE1Ra_searchRow",
			"searchWithQuery": "_7KE1Ra_searchWithQuery",
			"selected": "_7KE1Ra_selected",
			"status": "_7KE1Ra_status",
			"trigger": "_7KE1Ra_trigger",
			"triggerEffort": "_7KE1Ra_triggerEffort",
			"triggerIcon": "_7KE1Ra_triggerIcon",
			"triggerLabel": "_7KE1Ra_triggerLabel",
			"warning": "_7KE1Ra_warning"
		};
		//#endregion
		//#region lib/types/client/provider-order.js
		/** Shared provider display order for the composer and command model pickers. */
		/**
		* Put the account and official providers first, preserving every other relative order.
		* @param groups - Provider groups in catalog order.
		* @returns a sorted copy; model order within each group is unchanged.
		*/
		function orderModelProviders(groups) {
			return groups.toSorted((left, right) => (left.id === "deepseek-account" ? 0 : left.id === "deepseek-official" ? 1 : 2) - (right.id === "deepseek-account" ? 0 : right.id === "deepseek-official" ? 1 : 2));
		}
		//#endregion
		//#region dsh-model-groups: accordion provider sections
		/**
		* Request channel shared by the /model command action and the mounted composer seat:
		* the command has no menu implementation of its own, so asking the seat to open keeps a
		* single accordion list (provider sections) for both entries.
		*/
		const modelGroupsOpenRequests = (() => {
			const listeners = new Set();
			let sequence = 0;
			return {
				request() {
					sequence += 1;
					for (const listener of listeners) listener(sequence);
					return listeners.size;
				},
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				}
			};
		})();
		/** Extra classes for the accordion rows, layered over the shared menu surface. */
		const MG_CSS_ID = "dsh-model-groups/ModelGroups.module.css";
		const MG_CSS = ".mg_section{box-sizing:border-box;display:flex;align-items:center;gap:6px;width:auto;min-width:100%;height:32px;padding:0 8px;border:0;border-radius:var(--dsw-radius-md);background:0 0;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;text-align:left;cursor:pointer;outline:none}.mg_section:hover:not(:disabled),.mg_section:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}.mg_section:disabled{cursor:default}.mg_caret{flex:none;width:12px;height:12px;color:var(--dsw-alias-menu-icon);transition:transform .12s}.mg_caretOpen{transform:rotate(90deg)}.mg_sectionName{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}.mg_count{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}.mg_badge{flex:none;display:inline-grid;place-items:center;width:14px;height:14px;color:var(--dsw-alias-label-primary)}.mg_badge svg{width:14px;height:14px}.mg_failures{flex-direction:column;display:flex;gap:3px}.mg_nested{padding-left:26px}.mg_groups{flex:0 1 auto;min-height:0}.mg_effortBar{position:relative;flex:none;display:flex;flex-direction:column;margin-top:2px;padding-top:2px;border-top:1px solid var(--dsw-alias-border-l1)}.mg_effortCell{box-sizing:border-box;width:100%;border:0;background:0 0;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:20px;border-radius:var(--dsw-radius-md);cursor:pointer;text-align:left}.mg_effortCell:hover:not(:disabled),.mg_effortCell[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover)}.mg_effortCell:disabled{cursor:default}.mg_effortLabel{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}.mg_flyout{position:absolute;bottom:0;z-index:6;display:flex;flex-direction:column;gap:2px;min-width:152px;max-width:230px;max-height:min(300px,50vh);overflow-y:auto;padding:4px;background-color:#3b3c44!important;background-image:none!important;border:1px solid var(--dsw-alias-border-l1,#ffffff0f);border-radius:var(--dsw-radius-lg,16px);box-shadow:var(--dsw-elevation-prominent)}.mg_menuSolid{background-color:#313238!important;background-image:none!important}.mg_menuSolid [class*=_material_]{display:none!important}.mg_flyoutRight{left:calc(100% + 6px)}.mg_flyoutLeft{right:calc(100% + 6px)}.mg_flyoutRow{width:100%}";
		if (typeof document !== "undefined") {
			const existing = document.querySelector("style[data-plugin-css=" + JSON.stringify(MG_CSS_ID) + "]");
			const mgTag = existing ?? document.createElement("style");
			mgTag.dataset.plugin = "dsh-model-groups";
			mgTag.dataset.pluginCss = MG_CSS_ID;
			if (mgTag.textContent !== MG_CSS) mgTag.textContent = MG_CSS;
			if (existing === null) document.head.appendChild(mgTag);
		}
		const MG = {
			badge: "mg_badge",
			caret: "mg_caret",
			caretOpen: "mg_caretOpen",
			count: "mg_count",
			effortBar: "mg_effortBar",
			effortCell: "mg_effortCell",
			effortLabel: "mg_effortLabel",
			flyout: "mg_flyout",
			flyoutLeft: "mg_flyoutLeft",
			flyoutRight: "mg_flyoutRight",
			flyoutRow: "mg_flyoutRow",
			groups: "mg_groups",
			menuSolid: "mg_menuSolid",
			nested: "mg_nested",
			section: "mg_section",
			sectionName: "mg_sectionName"
		};
		const mgJsx = react_jsx_runtime.jsx;
		const mgJsxs = react_jsx_runtime.jsxs;
		const mgFragment = react_jsx_runtime.Fragment;
		const mgP = _deepseek_ai_dsh_client_ui_primitives;
		const mgCss = ModelSelect_module_css_default;
		/** Unplaced portal card: hidden but laid out at a fixed origin so offsetWidth/offsetHeight are real (Menu primitive's measure pass). */
		const MEASURE_STYLE = {
			visibility: "hidden",
			left: 0,
			top: 0
		};
		/**
		* ModelGroupsSelect: the composer's named model seat, with the catalog folded into one
		* section per provider (accordion) instead of a flat list. Opening the seat collapses
		* every section except the current model's provider, which opens filtered down to that
		* single model; typing in the always-visible search box expands every matching section
		* and narrows its rows to the matches. Effort levels ride the same accordion as one more
		* section so the menu keeps a single scroll container.
		* @param props - owner share (locked) + injected face (shared directory store/verbs) + the standard locale seat.
		* @returns the trigger and, while open, the accordion menu.
		*/
		function ModelGroupsSelect({ locked, available, directory, load, select, t, renderSlot }) {
			const state = (0, react.useSyncExternalStore)((fn) => directory.subscribe(fn), () => directory.getSnapshot());
			const [open, setOpen] = (0, react.useState)(false);
			const [query, setQuery] = (0, react.useState)("");
			const [solo, setSolo] = (0, react.useState)(null);
			const [expanded, setExpanded] = (0, react.useState)(() => new Set());
			const [effortOpen, setEffortOpen] = (0, react.useState)(false);
			const [effortSide, setEffortSide] = (0, react.useState)("right");
			const [highlight, setHighlight] = (0, react.useState)(null);
			const [selectionFocus, setSelectionFocus] = (0, react.useState)(false);
			const lastActionRef = (0, react.useRef)("load");
			const [toast, setToast] = (0, react.useState)(null);
			const toastSeq = (0, react.useRef)(0);
			const rootRef = (0, react.useRef)(null);
			const triggerRef = (0, react.useRef)(null);
			const searchRef = (0, react.useRef)(null);
			const menuRef = (0, react.useRef)(null);
			const groupsRef = (0, react.useRef)(null);
			const rowRefs = (0, react.useRef)([]);
			const effortBarRef = (0, react.useRef)(null);
			const flyoutRef = (0, react.useRef)(null);
			const effortTimer = (0, react.useRef)(null);
			const [menuPos, setMenuPos] = (0, react.useState)(null);
			const id = (0, react.useId)();
			const accountProviderName = t("provider.account");
			const groups = (0, react.useMemo)(() => orderModelProviders(state.groups).map((group) => ({
				id: group.id,
				models: group.models,
				name: group.id === "deepseek-account" ? accountProviderName : group.name
			})), [state.groups, accountProviderName]);
			const currentChoice = (() => {
				if (state.current === null) return null;
				for (const group of groups) for (const model of group.models) if (group.id === state.current.provider && model.id === state.current.model) return {
					group,
					model
				};
				return null;
			})();
			const reasoning = currentChoice === null ? void 0 : currentChoice.model.reasoning;
			const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort;
			const effortLabel = currentChoice === null ? void 0 : reasoning === void 0 ? state.retainedEffort : effectiveEffort === void 0 ? t("effort.providerDefault") : reasoning.efforts.find((level) => level.id === effectiveEffort)?.name ?? effectiveEffort;
			const effortChoices = (0, react.useMemo)(() => reasoning === void 0 ? [] : [...reasoning.defaultEffort === void 0 ? [{
				key: "provider-default",
				effort: void 0,
				label: t("effort.providerDefault")
			}] : [], ...reasoning.efforts.map((effort) => ({
				key: "effort:" + effort.id,
				effort: effort.id,
				label: effort.name
			}))], [reasoning, t]);
			const { pending } = state;
			const busy = pending !== null;
			const queryText = query.trim();
			const searching = queryText !== "";
			const sections = (0, react.useMemo)(() => {
				const needle = queryText.toLowerCase();
				return groups.map((group) => {
					if (!searching) return {
						group,
						models: group.models
					};
					const providerHit = group.name.toLowerCase().includes(needle);
					return {
						group,
						models: providerHit ? group.models : mgP.rankByName(group.models, queryText)
					};
				}).filter((section) => section.models.length > 0);
			}, [groups, queryText, searching]);
			const isExpanded = (section) => searching || expanded.has(section.group.id) || solo === section.group.id;
			const visibleModels = (section) => {
				if (searching) return section.models;
				if (solo === section.group.id && !expanded.has(section.group.id)) return section.models.filter((model) => state.current?.provider === section.group.id && state.current?.model === model.id);
				return section.models;
			};
			const rows = [];
			for (const section of sections) {
				rows.push({
					section,
					type: "provider"
				});
				if (isExpanded(section)) for (const model of visibleModels(section)) rows.push({
					model,
					section,
					type: "model"
				});
			}
			const highlightIndex = highlight === null ? -1 : Math.min(highlight, rows.length - 1);
			const reload = () => {
				lastActionRef.current = "load";
				load();
			};
			(0, react.useEffect)(() => {
				if (!open) return;
				const closeOutside = (event) => {
					if (rootRef.current?.contains(event.target) === true) return;
					if (menuRef.current?.contains(event.target) === true) return;
					setOpen(false);
				};
				document.addEventListener("mousedown", closeOutside);
				return () => {
					document.removeEventListener("mousedown", closeOutside);
				};
			}, [open]);
			/**
			* The search box owns the keyboard the moment the menu appears: a portal + the
			* surface's measure pass mean the input can mount one commit later, and the
			* composer's contenteditable grabs focus back right after the click, so keep
			* retrying across the next frames until the input really holds the focus.
			*/
			const searchNode = () => {
				const node = searchRef.current;
				if (node !== null && node.tagName === "INPUT") return node;
				return menuRef.current?.querySelector("input") ?? null;
			};
			const focusSearch = () => {
				const node = searchNode();
				if (node === null) return false;
				const active = document.activeElement;
				if (active === node) return true;
				if (active !== null && menuRef.current?.contains(active) === true) return true;
				node.focus({
					preventScroll: true
				});
				return document.activeElement === node;
			};
			(0, react.useLayoutEffect)(() => {
				if (!open) return;
				if (focusSearch()) return;
				const frame = window.requestAnimationFrame(() => {
					focusSearch();
				});
				const timer = window.setTimeout(focusSearch, 60);
				return () => {
					window.cancelAnimationFrame(frame);
					window.clearTimeout(timer);
				};
			}, [open, menuPos]);
			/** Paint the surfaces solid regardless of stylesheet state: inline !important beats any token. */
			const hardenSurface = () => {
				const menuNode = menuRef.current;
				if (menuNode !== null && menuNode !== void 0) {
					menuNode.style.setProperty("background-color", "#313238", "important");
					menuNode.style.setProperty("background-image", "none", "important");
					menuNode.querySelectorAll("[class*=_material_]").forEach((node) => {
						node.style.setProperty("display", "none", "important");
					});
				}
				const flyoutNode = flyoutRef.current;
				if (flyoutNode !== null && flyoutNode !== void 0) {
					flyoutNode.style.setProperty("background-color", "#3b3c44", "important");
					flyoutNode.style.setProperty("background-image", "none", "important");
					flyoutNode.style.setProperty("backdrop-filter", "none", "important");
				}
			};
			(0, react.useLayoutEffect)(() => {
				if (!open) return;
				hardenSurface();
				const frame = window.requestAnimationFrame(hardenSurface);
				return () => {
					window.cancelAnimationFrame(frame);
				};
			}, [open, menuPos, effortOpen, effortSide, state.status, query]);
			(0, react.useLayoutEffect)(() => {
				if (!available || !open) {
					setMenuPos(null);
					return;
				}
				const place = () => {
					const rect = triggerRef.current?.getBoundingClientRect();
					if (rect === void 0) return;
					const MARGIN = 12;
					const lw = menuRef.current?.offsetWidth ?? 0;
					const lh = menuRef.current?.offsetHeight ?? 0;
					let x = rect.right - lw;
					let y = rect.top - 8 - lh;
					if (lw > 0) x = Math.min(Math.max(x, MARGIN), window.innerWidth - lw - MARGIN);
					if (lh > 0) y = Math.min(Math.max(y, MARGIN), window.innerHeight - lh - MARGIN);
					setMenuPos({
						left: x,
						top: y
					});
				};
				place();
				window.addEventListener("scroll", place, true);
				window.addEventListener("resize", place);
				const menu = menuRef.current;
				const observer = typeof ResizeObserver !== "undefined" && menu !== null ? new ResizeObserver(place) : null;
				if (menu !== null) observer?.observe(menu);
				return () => {
					observer?.disconnect();
					window.removeEventListener("scroll", place, true);
					window.removeEventListener("resize", place);
				};
			}, [
				available,
				open,
				state,
				query,
				expanded,
				solo,
				effortOpen
			]);
			(0, react.useEffect)(() => {
				if (!open || highlight !== null) return;
				const at = rows.findIndex((row) => row.type === "model" && state.current !== null && row.section.group.id === state.current.provider && row.model.id === state.current.model);
				if (at >= 0) setHighlight(at);
			}, [open, highlight, sections, expanded, solo, searching]);
			(0, react.useLayoutEffect)(() => {
				if (!open || highlightIndex < 0) return;
				rowRefs.current[highlightIndex]?.scrollIntoView({ block: "nearest" });
			}, [
				open,
				highlightIndex,
				query,
				expanded,
				solo,
				effortOpen
			]);
			const showRef = (0, react.useRef)(() => {});
			(0, react.useEffect)(() => modelGroupsOpenRequests.subscribe(() => {
				if (!available || locked) return;
				showRef.current();
			}), [available, locked]);
			if (!available) return null;
			const settleSelection = (result) => {
				if (result === void 0) return;
				if (result.ok) {
					closeAfterSelection();
					return;
				}
				toastSeq.current += 1;
				setToast({
					seq: toastSeq.current,
					text: result.error.code === "session/writer-held" ? t("error.sessionInUse") : t("error.action", { message: result.error.code + ": " + result.error.message })
				});
			};
			const submit = (selection) => {
				lastActionRef.current = "select";
				setSelectionFocus(true);
				triggerRef.current?.focus();
				select(selection).then(settleSelection);
			};
			const chooseModel = (providerId, model) => {
				if (state.current?.provider === providerId && state.current.model === model.id) {
					closeAfterSelection();
					return;
				}
				submit({
					model: model.id,
					provider: providerId
				});
			};
			const chooseEffort = (effort) => {
				if (state.current === null) return;
				if (effectiveEffort === effort) {
					closeAfterSelection();
					return;
				}
				submit({
					model: state.current.model,
					provider: state.current.provider,
					...effort === void 0 ? {} : { reasoningEffort: effort }
				});
			};
			const clearEffortTimer = () => {
				if (effortTimer.current !== null) {
					window.clearTimeout(effortTimer.current);
					effortTimer.current = null;
				}
			};
			/** Hover-in: open the level panel beside the menu, flipping to the left when the right edge is short on room. */
			const showEffort = () => {
				clearEffortTimer();
				const rect = menuRef.current?.getBoundingClientRect();
				if (rect !== void 0) setEffortSide(rect.right + 246 > window.innerWidth - 8 ? "left" : "right");
				setEffortOpen(true);
			};
			const hideEffortSoon = () => {
				clearEffortTimer();
				effortTimer.current = window.setTimeout(() => {
					setEffortOpen(false);
				}, 140);
			};
			(0, react.useEffect)(() => () => {
				clearEffortTimer();
			}, []);
			const toggleProvider = (providerId) => {
				if (searching) {
					setQuery("");
					setSolo(null);
					setEffortOpen(false);
					setExpanded(new Set([providerId]));
					setHighlight(null);
					return;
				}
				if (solo === providerId) {
					setSolo(null);
					setExpanded((previous) => {
						const next = new Set(previous);
						next.add(providerId);
						return next;
					});
					return;
				}
				setExpanded((previous) => {
					const next = new Set(previous);
					if (next.has(providerId)) next.delete(providerId);
					else next.add(providerId);
					return next;
				});
			};
			const show = () => {
				setSelectionFocus(false);
				setQuery("");
				setHighlight(null);
				setEffortOpen(false);
				setSolo(state.current?.provider ?? null);
				setExpanded(new Set());
				setOpen(true);
				reload();
			};
			showRef.current = show;
			const changeQuery = (next) => {
				const cleared = next.trim() === "";
				setQuery(next);
				setHighlight(cleared ? null : 0);
				setExpanded(new Set());
				setSolo(cleared ? state.current?.provider ?? null : null);
			};
			const close = (restoreFocus = false) => {
				setOpen(false);
				setSolo(null);
				setExpanded(new Set());
				setEffortOpen(false);
				if (restoreFocus) queueMicrotask(() => {
					triggerRef.current?.focus();
				});
			};
			const closeAfterSelection = () => {
				setSelectionFocus(true);
				close(true);
			};
			const activateRow = (row) => {
				if (row === void 0) return;
				if (row.type === "provider") {
					toggleProvider(row.section.group.id);
					return;
				}
				if (row.type === "model") {
					chooseModel(row.section.group.id, row.model);
					return;
				}
			};
			const onRootKeyDown = (event) => {
				if (event.nativeEvent.isComposing) return;
				if (event.key === "Escape" && open) {
					event.preventDefault();
					if (effortOpen) {
						setEffortOpen(false);
						return;
					}
					if (query !== "") {
						changeQuery("");
						return;
					}
					close(true);
					return;
				}
				if (!open) return;
				if (event.key === "ArrowDown" || event.key === "ArrowUp") {
					event.preventDefault();
					if (rows.length === 0) return;
					const step = event.key === "ArrowDown" ? 1 : -1;
					const next = highlightIndex < 0 ? step > 0 ? 0 : rows.length - 1 : (highlightIndex + step + rows.length) % rows.length;
					setHighlight(next);
					return;
				}
				if (event.key === "Enter" || event.key === "Tab" && !event.shiftKey) {
					if (event.target instanceof HTMLButtonElement) return;
					event.preventDefault();
					if (!busy && rows[highlightIndex] !== void 0) activateRow(rows[highlightIndex]);
				}
			};
			const waiting = currentChoice === null && state.status === "loading";
			const modelLabel = waiting ? t("trigger.loading") : currentChoice?.model.name ?? t("trigger.fallback");
			const triggerLabel = effortLabel === void 0 ? modelLabel : modelLabel + " · " + effortLabel;
			const triggerAria = waiting ? t("trigger.loading") : currentChoice === null ? t("trigger.selectAria") : effortLabel === void 0 ? t("trigger.aria", { model: modelLabel }) : t("trigger.ariaEffort", {
				effort: effortLabel,
				model: modelLabel
			});
			const renderModelLabel = (provider, model, placement, selected) => mgJsx("span", {
				"data-model-id": model.id,
				"data-provider-id": provider.id,
				children: renderSlot("conversation.input.model.label", {
					model,
					placement,
					provider,
					selected
				}, { fallback: model.name })
			});
			let rowIndex = 0;
			const rowRef = () => {
				const at = rowIndex++;
				return (node) => {
					rowRefs.current[at] = node;
				};
			};
			const empty = state.status === "ready" && sections.length === 0;
			return mgJsxs("div", {
				className: mgCss.root,
				onKeyDown: onRootKeyDown,
				onMouseDown: (event) => {
					if (event.target instanceof Element && event.target.closest("button") !== null) event.preventDefault();
				},
				ref: rootRef,
				children: [
					mgJsxs("button", {
						"aria-busy": busy,
						"aria-controls": open ? id + "-menu" : void 0,
						"aria-expanded": open,
						"aria-haspopup": "menu",
						"aria-label": triggerAria,
						"data-selection-focus": selectionFocus ? "" : void 0,
						className: mgCss.trigger,
						disabled: locked,
						onBlur: () => {
							setSelectionFocus(false);
						},
						onClick: () => {
							if (open) close(true);
							else show();
						},
						ref: triggerRef,
						title: triggerLabel,
						type: "button",
						children: [
							mgJsx(mgP.IconDataOutlineRegular, {
								className: mgCss.triggerIcon,
								size: 16
							}),
							mgJsx("span", {
								className: mgCss.triggerLabel,
								children: currentChoice === null ? modelLabel : renderModelLabel(currentChoice.group, currentChoice.model, "trigger", true)
							}),
							effortLabel !== void 0 && mgJsx("span", {
								className: mgCss.triggerEffort,
								children: effortLabel
							}),
							busy ? mgJsx(mgP.StateDot, { state: "ongoing" }) : mgJsx(mgP.IconChevronDownOutlineRegular, { className: clsx(mgCss.chevron, open && mgCss.chevronOpen) })
						]
					}),
					open && (0, react_dom.createPortal)(mgJsxs(mgP.MenuSurface, {
						"aria-busy": state.status === "loading" || busy,
						"aria-label": t("menu.aria"),
						className: clsx(mgCss.menu, MG.menuSolid),
						id: id + "-menu",
						onKeyDown: onRootKeyDown,
						ref: menuRef,
						role: "menu",
						style: {
							...(menuPos ?? MEASURE_STYLE),
							overflow: "visible"
						},
						children: [
							mgJsxs("div", {
								className: mgCss.searchRow,
								children: [mgJsx(mgP.Input, {
									"aria-label": t("search.placeholder"),
									className: clsx(mgCss.search, query !== "" && mgCss.searchWithQuery),
									onChange: (event) => {
										changeQuery(event.target.value);
									},
									placeholder: t("search.placeholder"),
									ref: searchRef,
									value: query
								}), query !== "" && mgJsx("button", {
									"aria-label": t("search.clear"),
									className: mgCss.searchClear,
									onClick: () => {
										changeQuery("");
										searchRef.current?.focus();
									},
									type: "button",
									children: mgJsx(mgP.IconCloseFillRegular, {})
								})]
							}),
							state.status === "loading" && mgJsx("div", {
								className: mgCss.status,
								children: t("status.loading")
							}),
							state.error !== null && lastActionRef.current === "load" && mgJsxs("div", {
								className: mgCss.error,
								children: [mgJsx("span", { children: t("error.action", { message: state.error }) }), mgJsx("button", {
									className: mgCss.retry,
									onClick: reload,
									type: "button",
									children: t("action.reload")
								})]
							}),
							state.failures.map((failure) => mgJsxs("div", {
								className: mgCss.warning,
								children: [mgJsx("span", { children: t("warning.groupLoad", {
									message: failure.message,
									name: failure.id === "deepseek-account" ? t("provider.account") : failure.name
								}) }), mgJsx("button", {
									className: mgCss.retry,
									onClick: reload,
									type: "button",
									children: t("action.reload")
								})]
							}, failure.id)),
							mgJsx("div", {
								className: clsx(mgCss.groups, MG.groups, "scrollable"),
								hidden: sections.length === 0 && !empty,
								id: id + "-models",
								ref: groupsRef,
								role: "group",
								children: [
									...sections.map((section) => {
										const expandedNow = isExpanded(section);
										const hasCurrent = state.current?.provider === section.group.id;
										const models = visibleModels(section);
										return mgJsxs(mgFragment, { children: [mgJsxs("button", {
											"aria-expanded": expandedNow,
											"aria-label": t("section.aria", {
												count: String(section.group.models.length),
												name: section.group.name
											}),
											className: MG.section,
											disabled: busy,
											onClick: () => {
												toggleProvider(section.group.id);
											},
											ref: rowRef(),
											role: "menuitem",
											type: "button",
											children: [
												mgJsx(mgP.IconChevronRightOutlineRegular, { className: clsx(MG.caret, expandedNow && MG.caretOpen) }),
												mgJsx("span", {
													className: MG.sectionName,
													children: section.group.name
												}),
												mgJsx("span", {
													className: MG.count,
													children: String(section.group.models.length)
												}),
												hasCurrent && mgJsx("span", {
													className: MG.badge,
													children: mgJsx(mgP.IconCheckOutlineRegular, {})
												})
											]
										}), expandedNow && models.map((model) => {
											const selected = state.current?.provider === section.group.id && state.current.model === model.id;
											const at = rows.findIndex((row) => row.type === "model" && row.model === model && row.section.group.id === section.group.id);
											return mgJsxs("button", {
												"aria-checked": selected,
												className: clsx(mgCss.option, mgCss.modelOption, MG.nested, selected && mgCss.selected, at === highlightIndex && mgCss.optionActive),
												disabled: busy,
												onClick: () => {
													chooseModel(section.group.id, model);
												},
												onMouseMove: busy || at === highlightIndex ? void 0 : () => {
													setHighlight(at);
												},
												ref: rowRef(),
												role: "menuitemradio",
												title: model.name,
												type: "button",
												children: [mgJsx("span", {
													className: mgCss.optionCopy,
													children: mgJsx("span", {
														className: mgCss.modelName,
														children: renderModelLabel(section.group, model, "option", selected)
													})
												}), mgJsx("span", {
													className: mgCss.check,
													children: pending?.provider === section.group.id && pending.model === model.id ? mgJsx(mgP.StateDot, { state: "ongoing" }) : selected ? mgJsx(mgP.IconCheckOutlineRegular, {}) : null
												})]
											}, model.id);
										})] });
									}),
								]
							}),
							reasoning !== void 0 && mgJsxs("div", {
								className: MG.effortBar,
								onKeyDown: (event) => {
									if (event.key === "Escape" && effortOpen) {
										event.preventDefault();
										event.stopPropagation();
										setEffortOpen(false);
										return;
									}
									if (event.key === "ArrowDown" || event.key === "ArrowUp") {
										event.preventDefault();
										event.stopPropagation();
										const last = event.key === "ArrowUp";
										const step = () => {
											const items = [...(flyoutRef.current?.querySelectorAll("button") ?? [])];
											if (items.length === 0) return;
											items[last ? items.length - 1 : 0]?.focus();
										};
										if (effortOpen) {
											step();
											return;
										}
										showEffort();
										window.requestAnimationFrame(step);
										return;
									}
									if (event.key === "ArrowRight" && !effortOpen) {
										event.preventDefault();
										showEffort();
									}
								},
								onMouseEnter: busy ? void 0 : showEffort,
								onMouseLeave: busy ? void 0 : hideEffortSoon,
								ref: effortBarRef,
								children: [mgJsxs("button", {
									"aria-expanded": effortOpen,
									"aria-haspopup": "menu",
									"aria-label": t("menu.effort"),
									className: clsx(mgCss.cell, MG.effortCell),
									disabled: busy,
									onClick: () => {
										if (effortOpen) setEffortOpen(false);
										else showEffort();
									},
									type: "button",
									children: [mgJsx("span", {
										className: clsx(mgCss.cellLabel, MG.effortLabel),
										children: t("menu.effort")
									}), mgJsx("span", {
										className: mgCss.cellValue,
										children: effortLabel
									}), mgJsx(mgP.IconChevronRightOutlineRegular, {
										className: clsx(mgCss.cellChevron, effortOpen && MG.caretOpen)
									})]
								}), effortOpen && mgJsx("div", {
									"aria-label": t("menu.effort"),
									className: clsx(MG.flyout, effortSide === "left" ? MG.flyoutLeft : MG.flyoutRight),
									onKeyDown: (event) => {
										if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "ArrowLeft" && event.key !== "Escape") return;
										event.preventDefault();
										event.stopPropagation();
										if (event.key === "ArrowLeft" || event.key === "Escape") {
											setEffortOpen(false);
											effortBarRef.current?.querySelector("button")?.focus();
											return;
										}
										const items = [...(flyoutRef.current?.querySelectorAll("button") ?? [])];
										if (items.length === 0) return;
										const at = items.indexOf(document.activeElement);
										const step = event.key === "ArrowDown" ? 1 : -1;
										items[at < 0 ? 0 : (at + step + items.length) % items.length]?.focus();
									},
									ref: flyoutRef,
									role: "menu",
									children: effortChoices.map((level) => {
										const selected = effectiveEffort === level.effort;
										return mgJsxs("button", {
											"aria-checked": selected,
											className: clsx(mgCss.option, MG.flyoutRow, selected && mgCss.selected),
											disabled: busy,
											onClick: () => {
												setEffortOpen(false);
												chooseEffort(level.effort);
											},
											role: "menuitemradio",
											type: "button",
											children: [mgJsx("span", {
												className: mgCss.optionCopy,
												children: mgJsx("span", {
													className: mgCss.modelName,
													children: level.label
												})
											}), mgJsx("span", {
												className: mgCss.check,
												children: selected ? mgJsx(mgP.IconCheckOutlineRegular, {}) : null
											})]
										}, level.key);
									})
								})]
							}),
							empty && mgJsx("div", {
								className: mgCss.empty,
								role: "status",
								children: t(groups.length === 0 ? "empty.models" : "search.empty")
							})
						]
					}), document.body),
					toast !== null && mgJsx(mgP.Toast, {
						anchor: rootRef.current?.closest("[data-composer-card]") ?? null,
						icon: mgJsx(mgP.IconWarningOutlineRegular, {}),
						onDone: () => {
							setToast(null);
						},
						text: toast.text
					}, toast.seq)
				]
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/**
		* `model` namespace dictionaries.
		*
		* `trigger.selectAria` intentionally matches `trigger.fallback` but remains a
		* separate key: the visible fallback label and the accessible name of
		* an unset trigger are free to diverge per locale, and folding it into
		* `trigger.aria` would announce the degenerate "Select model, current Select
		* model".
		*/
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"provider.account": "DeepSeek 账号",
			"command.label": "模型",
			"command.description": "选择本会话使用的模型",
			"option.loadError": "目录加载失败：{message}",
			"trigger.fallback": "请选择模型",
			"trigger.loading": "正在加载模型…",
			"trigger.selectAria": "请选择模型",
			"trigger.aria": "选择模型，当前 {model}",
			"trigger.ariaEffort": "选择模型，当前 {model}，推理等级 {effort}",
			"menu.aria": "模型与推理等级",
			"menu.model": "模型",
			"menu.effort": "推理等级",
			"effort.providerDefault": "Default",
			"status.loading": "正在刷新模型列表…",
			"error.action": "模型操作失败：{message}",
			"error.sessionInUse": "当前会话已被占用，可能是其他正在运行的 DSH 导致的（如其他 dsh web、桌面端），请退出其他正在运行的 DSH 后重试。",
			"action.reload": "重新加载",
			"warning.groupLoad": "{name} 加载失败：{message}",
			"search.placeholder": "搜索模型…",
			"search.clear": "清除搜索",
			"search.empty": "没有匹配的模型。",
			"empty.models": "暂无可用模型",
			"empty.efforts": "当前模型未提供推理等级。",
			"section.aria": "{name}，{count} 个模型",
			"section.selectedBadge": "当前模型所在供应商"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"provider.account": "DeepSeek Account",
			"command.label": "Model",
			"command.description": "Select the model for this conversation",
			"option.loadError": "Catalog failed to load: {message}",
			"trigger.fallback": "Select model",
			"trigger.loading": "Loading models…",
			"trigger.selectAria": "Select model",
			"trigger.aria": "Select model, current {model}",
			"trigger.ariaEffort": "Select model, current {model}, reasoning effort {effort}",
			"menu.aria": "Model and reasoning effort",
			"menu.model": "Model",
			"menu.effort": "Effort",
			"effort.providerDefault": "Default",
			"status.loading": "Refreshing model list…",
			"error.action": "Model operation failed: {message}",
			"error.sessionInUse": "This session is already in use, possibly by another running DSH instance (such as dsh web or the desktop app). Quit other running DSH instances and try again.",
			"action.reload": "Reload",
			"warning.groupLoad": "{name} failed to load: {message}",
			"search.placeholder": "Search models…",
			"search.clear": "Clear search",
			"search.empty": "No matching models.",
			"empty.models": "No models available.",
			"empty.efforts": "This model provides no reasoning effort levels.",
			"section.aria": "{name}, {count} models",
			"section.selectedBadge": "Provider of the current model"
		};
		//#endregion
		//#region lib/types/client/index.js
		/** One selectable row's id: an opaque row key (resolved by lookup, never parsed). */
		function rowId(providerId, modelId) {
			return `${providerId}/${modelId}`;
		}
		/** Flatten the directory into popup rows; failure rows are listed for visibility but never selectable. */
		function optionsOf(directory, t) {
			const rows = [];
			for (const group of orderModelProviders(directory.groups)) {
				const name = group.id === "deepseek-account" ? t("provider.account") : group.name;
				for (const model of group.models) rows.push({
					id: rowId(group.id, model.id),
					label: model.name,
					group: {
						name: group.id,
						label: name
					},
					...directory.current !== null && directory.current.provider === group.id && directory.current.model === model.id ? { active: true } : {}
				});
			}
			for (const failure of directory.failures) rows.push({
				id: `failure/${failure.id}`,
				label: failure.id === "deepseek-account" ? t("provider.account") : failure.name,
				detail: t("option.loadError", { message: failure.message })
			});
			return rows;
		}
		/**
		* Resolve a picked row back to its model selection by matching against the loaded
		* groups (the same data the rows were built from — ids stay opaque).
		* @param state - the session's directory snapshot.
		* @param id - the picked row id.
		* @returns the row's model selection, or undefined for failure rows / stale ids.
		*/
		function selectionOf(state, id) {
			for (const group of state.groups) for (const model of group.models) {
				if (rowId(group.id, model.id) !== id) continue;
				const reasoningEffort = state.current?.provider === group.id && state.current.model === model.id ? state.current?.reasoningEffort ?? model.reasoning?.defaultEffort : model.reasoning?.defaultEffort;
				return {
					provider: group.id,
					model: model.id,
					...reasoningEffort === void 0 ? {} : { reasoningEffort }
				};
			}
		}
		/** Dictionary namespace owned by this plugin. */
		const NS = "model";
		/** Required services: the contribution registry, the seat's slot registry, locale, and the service's own faces. */
		const inject = [
			"commandUi",
			"locale",
			"sessions",
			"slots",
			"remote",
			"remote.session"
		];
		/**
		* Client plugin body: mount ModelDirectoryResolver, register the `model` dictionaries,
		* then register the /model popup contribution and the composer model seat
		* over the service.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-model-selection: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.plugin(ModelDirectoryResolver);
			ctx.inject(["commandUi", "modelDirectories"], (scope) => {
				const command = scope.get("commandUi");
				const models = scope.modelDirectories;
				const sessions = scope.sessions;
				scope.effect(() => command.register({
					name: "model",
					label: () => t("command.label"),
					description: () => t("command.description"),
					icon: _deepseek_ai_dsh_client_ui_primitives.IconDataOutlineRegular,
					available: (session) => sessions.subagentAddress(session.sessionId) === void 0,
					ui: {
						kind: "action",
						run: () => {
							modelGroupsOpenRequests.request();
						}
					}
				}), "dsh-model-groups: /model contribution");
			});
			ctx.inject(["slots", "modelDirectories"], (scope) => {
				const models = scope.modelDirectories;
				const sessions = scope.sessions;
				scope.slots.inject("conversation.input.model", () => scope.slots.register({
					name: "conversation.input.model",
					locale: NS,
					children: { "conversation.input.model.label": {
						kind: "single",
						scope: "session",
						inline: true
					} },
					inject: (sessionId) => {
						const directory = models.directoryFor(sessionId);
						const available = sessions.subagentAddress(sessionId) === void 0;
						return {
							available,
							directory: directory.store,
							load: () => {
								if (available) directory.load().catch(() => {});
							},
							select: (selection) => available ? directory.select(selection) : Promise.resolve(void 0)
						};
					}
				}, ModelGroupsSelect));
			});
		}
		//#endregion
		exports.ModelDirectory = ModelDirectory;
		exports.ModelDirectoryResolver = ModelDirectoryResolver;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map