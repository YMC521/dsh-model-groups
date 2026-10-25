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