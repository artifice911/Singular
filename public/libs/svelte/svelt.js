
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function (exports) {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.29.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src/Producto.svelte generated by Svelte v3.29.0 */

    const { Object: Object_1, console: console_1 } = globals;
    const file = "src/Producto.svelte";

    // (49:1) {#if visible}
    function create_if_block(ctx) {
    	let p;
    	let p_intro;
    	let p_outro;
    	let current;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Aceptando pantu-contrato";
    			add_location(p, file, 49, 2, 1204);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (p_outro) p_outro.end(1);
    				if (!p_intro) p_intro = create_in_transition(p, fly, { y: 200, duration: 2000 });
    				p_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (p_intro) p_intro.invalidate();
    			p_outro = create_out_transition(p, fade, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching && p_outro) p_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(49:1) {#if visible}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div2;
    	let div0;
    	let raw0_value = /*producto*/ ctx[0].mensaje + "";
    	let t0;
    	let img;
    	let img_src_value;
    	let t1;
    	let div1;
    	let h1;
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let h4;
    	let raw1_value = /*producto*/ ctx[0].descripcion + "";
    	let t6;
    	let p0;
    	let t7;
    	let t8_value = /*producto*/ ctx[0].precio + "";
    	let t8;
    	let t9;
    	let p1;
    	let t10;
    	let t11_value = /*producto*/ ctx[0].cantidad + "";
    	let t11;
    	let t12;
    	let a;
    	let t14;
    	let label;
    	let input;
    	let t15;
    	let t16;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*visible*/ ctx[1] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			t0 = space();
    			img = element("img");
    			t1 = space();
    			div1 = element("div");
    			h1 = element("h1");
    			t2 = text("CLICK ");
    			t3 = text(/*string*/ ctx[2]);
    			t4 = text("!");
    			t5 = space();
    			h4 = element("h4");
    			t6 = space();
    			p0 = element("p");
    			t7 = text("Precio: $");
    			t8 = text(t8_value);
    			t9 = space();
    			p1 = element("p");
    			t10 = text("Cantidad: ");
    			t11 = text(t11_value);
    			t12 = space();
    			a = element("a");
    			a.textContent = "COMPRAR";
    			t14 = space();
    			label = element("label");
    			input = element("input");
    			t15 = text(" Aceptar");
    			t16 = space();
    			if (if_block) if_block.c();
    			attr_dev(div0, "class", "alert alert-danger");
    			attr_dev(div0, "role", "alert");
    			add_location(div0, file, 35, 2, 628);
    			attr_dev(img, "class", "card-img-top");
    			if (img.src !== (img_src_value = "./img/img_avatar1.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Card image");
    			add_location(img, file, 36, 2, 706);
    			attr_dev(h1, "class", "svelte-uhs7s0");
    			add_location(h1, file, 38, 4, 808);
    			attr_dev(h4, "class", "card-title");
    			add_location(h4, file, 39, 4, 860);
    			attr_dev(p0, "class", "card-text");
    			add_location(p0, file, 40, 4, 921);
    			attr_dev(p1, "class", "card-text");
    			add_location(p1, file, 41, 4, 977);
    			attr_dev(a, "class", "btn btn-primary");
    			add_location(a, file, 42, 4, 1036);
    			attr_dev(input, "type", "checkbox");
    			add_location(input, file, 45, 2, 1119);
    			add_location(label, file, 44, 1, 1109);
    			attr_dev(div1, "class", "card-body");
    			add_location(div1, file, 37, 2, 780);
    			attr_dev(div2, "class", "card");
    			set_style(div2, "width", "400px");
    			add_location(div2, file, 34, 0, 587);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			div0.innerHTML = raw0_value;
    			append_dev(div2, t0);
    			append_dev(div2, img);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, h1);
    			append_dev(h1, t2);
    			append_dev(h1, t3);
    			append_dev(h1, t4);
    			append_dev(div1, t5);
    			append_dev(div1, h4);
    			h4.innerHTML = raw1_value;
    			append_dev(div1, t6);
    			append_dev(div1, p0);
    			append_dev(p0, t7);
    			append_dev(p0, t8);
    			append_dev(div1, t9);
    			append_dev(div1, p1);
    			append_dev(p1, t10);
    			append_dev(p1, t11);
    			append_dev(div1, t12);
    			append_dev(div1, a);
    			append_dev(div1, t14);
    			append_dev(div1, label);
    			append_dev(label, input);
    			input.checked = /*visible*/ ctx[1];
    			append_dev(label, t15);
    			append_dev(div1, t16);
    			if (if_block) if_block.m(div1, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(h1, "click", /*eventoClick*/ ctx[3], false, false, false),
    					listen_dev(a, "click", /*agregarAlCarrito*/ ctx[4], false, false, false),
    					listen_dev(input, "change", /*input_change_handler*/ ctx[7])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*producto*/ 1) && raw0_value !== (raw0_value = /*producto*/ ctx[0].mensaje + "")) div0.innerHTML = raw0_value;			if (!current || dirty & /*string*/ 4) set_data_dev(t3, /*string*/ ctx[2]);
    			if ((!current || dirty & /*producto*/ 1) && raw1_value !== (raw1_value = /*producto*/ ctx[0].descripcion + "")) h4.innerHTML = raw1_value;			if ((!current || dirty & /*producto*/ 1) && t8_value !== (t8_value = /*producto*/ ctx[0].precio + "")) set_data_dev(t8, t8_value);
    			if ((!current || dirty & /*producto*/ 1) && t11_value !== (t11_value = /*producto*/ ctx[0].cantidad + "")) set_data_dev(t11, t11_value);

    			if (dirty & /*visible*/ 2) {
    				input.checked = /*visible*/ ctx[1];
    			}

    			if (/*visible*/ ctx[1]) {
    				if (if_block) {
    					if (dirty & /*visible*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div1, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Producto", slots, []);
    	let { producto } = $$props, { carrito } = $$props;
    	let visible = true, string = "MY";

    	function contrato(p) {
    		$$invalidate(1, visible = !p);
    	}

    	function eventoClick() {
    		$$invalidate(2, string += "+");
    	}

    	function agregarAlCarrito() {
    		if (producto.cantidad) {
    			$$invalidate(5, carrito[producto.id] = producto, carrito);
    			console.log(document.getElementById("cantCarrito").innerText = Object.keys(carrito).length);
    		} else {
    			alert("stoking insuficiente");
    		}
    	}

    	const writable_props = ["producto", "carrito"];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Producto> was created with unknown prop '${key}'`);
    	});

    	function input_change_handler() {
    		visible = this.checked;
    		$$invalidate(1, visible);
    	}

    	$$self.$$set = $$props => {
    		if ("producto" in $$props) $$invalidate(0, producto = $$props.producto);
    		if ("carrito" in $$props) $$invalidate(5, carrito = $$props.carrito);
    	};

    	$$self.$capture_state = () => ({
    		fade,
    		fly,
    		producto,
    		carrito,
    		visible,
    		string,
    		contrato,
    		eventoClick,
    		agregarAlCarrito
    	});

    	$$self.$inject_state = $$props => {
    		if ("producto" in $$props) $$invalidate(0, producto = $$props.producto);
    		if ("carrito" in $$props) $$invalidate(5, carrito = $$props.carrito);
    		if ("visible" in $$props) $$invalidate(1, visible = $$props.visible);
    		if ("string" in $$props) $$invalidate(2, string = $$props.string);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		producto,
    		visible,
    		string,
    		eventoClick,
    		agregarAlCarrito,
    		carrito,
    		contrato,
    		input_change_handler
    	];
    }

    class Producto extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { producto: 0, carrito: 5, contrato: 6 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Producto",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*producto*/ ctx[0] === undefined && !("producto" in props)) {
    			console_1.warn("<Producto> was created without expected prop 'producto'");
    		}

    		if (/*carrito*/ ctx[5] === undefined && !("carrito" in props)) {
    			console_1.warn("<Producto> was created without expected prop 'carrito'");
    		}
    	}

    	get producto() {
    		throw new Error("<Producto>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set producto(value) {
    		throw new Error("<Producto>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get carrito() {
    		throw new Error("<Producto>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set carrito(value) {
    		throw new Error("<Producto>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get contrato() {
    		return this.$$.ctx[6];
    	}

    	set contrato(value) {
    		throw new Error("<Producto>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Productos.svelte generated by Svelte v3.29.0 */

    const { console: console_1$1 } = globals;
    const file$1 = "src/Productos.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (29:0) {#each arr as producto}
    function create_each_block(ctx) {
    	let producto;
    	let current;

    	producto = new Producto({
    			props: {
    				producto: /*producto*/ ctx[4],
    				carrito: /*carrito*/ ctx[1]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(producto.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(producto, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const producto_changes = {};
    			if (dirty & /*arr*/ 4) producto_changes.producto = /*producto*/ ctx[4];
    			if (dirty & /*carrito*/ 2) producto_changes.carrito = /*carrito*/ ctx[1];
    			producto.$set(producto_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(producto.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(producto.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(producto, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(29:0) {#each arr as producto}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let h1;
    	let t0;
    	let t1;
    	let h5;
    	let t2;
    	let span;
    	let t4;
    	let each_1_anchor;
    	let current;
    	let each_value = /*arr*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t0 = text(/*titulo*/ ctx[0]);
    			t1 = space();
    			h5 = element("h5");
    			t2 = text("Carrito: ");
    			span = element("span");
    			span.textContent = "0";
    			t4 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    			add_location(h1, file$1, 24, 0, 431);
    			attr_dev(span, "id", "cantCarrito");
    			add_location(span, file$1, 26, 13, 463);
    			add_location(h5, file$1, 26, 0, 450);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, h5, anchor);
    			append_dev(h5, t2);
    			append_dev(h5, span);
    			insert_dev(target, t4, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*titulo*/ 1) set_data_dev(t0, /*titulo*/ ctx[0]);

    			if (dirty & /*arr, carrito*/ 6) {
    				each_value = /*arr*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(h5);
    			if (detaching) detach_dev(t4);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Productos", slots, []);

    	let { titulo = "PRODUCTOS TIENDA COMPRERO" } = $$props,
    		{ carrito = {} } = $$props,
    		{ arr = [
    			{
    				id: 1,
    				stock: 3,
    				cantidad: 4,
    				precio: 1,
    				mensaje: "Este producto tarda 10 dias en llegar",
    				descripcion: "Pantufla de goma <strong>CHINA</strong>"
    			}
    		] } = $$props;

    	function setTitulo(t) {
    		$$invalidate(0, titulo = t);
    		console.log(carrito);
    	}

    	const writable_props = ["titulo", "carrito", "arr"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$1.warn(`<Productos> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("titulo" in $$props) $$invalidate(0, titulo = $$props.titulo);
    		if ("carrito" in $$props) $$invalidate(1, carrito = $$props.carrito);
    		if ("arr" in $$props) $$invalidate(2, arr = $$props.arr);
    	};

    	$$self.$capture_state = () => ({
    		Producto,
    		titulo,
    		carrito,
    		arr,
    		setTitulo
    	});

    	$$self.$inject_state = $$props => {
    		if ("titulo" in $$props) $$invalidate(0, titulo = $$props.titulo);
    		if ("carrito" in $$props) $$invalidate(1, carrito = $$props.carrito);
    		if ("arr" in $$props) $$invalidate(2, arr = $$props.arr);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [titulo, carrito, arr, setTitulo];
    }

    class Productos extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			titulo: 0,
    			carrito: 1,
    			arr: 2,
    			setTitulo: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Productos",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get titulo() {
    		return this.$$.ctx[0];
    	}

    	set titulo(titulo) {
    		this.$set({ titulo });
    		flush();
    	}

    	get carrito() {
    		return this.$$.ctx[1];
    	}

    	set carrito(carrito) {
    		this.$set({ carrito });
    		flush();
    	}

    	get arr() {
    		return this.$$.ctx[2];
    	}

    	set arr(arr) {
    		this.$set({ arr });
    		flush();
    	}

    	get setTitulo() {
    		return this.$$.ctx[3];
    	}

    	set setTitulo(value) {
    		throw new Error("<Productos>: Cannot set read-only property 'setTitulo'");
    	}
    }

    /* src/Ventana.svelte generated by Svelte v3.29.0 */

    const file$2 = "src/Ventana.svelte";

    function create_fragment$2(ctx) {
    	let button0;
    	let t0;
    	let div5;
    	let div4;
    	let div3;
    	let div0;
    	let h4;
    	let t2;
    	let button1;
    	let t4;
    	let div1;
    	let t6;
    	let div2;
    	let button2;

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			t0 = space();
    			div5 = element("div");
    			div4 = element("div");
    			div3 = element("div");
    			div0 = element("div");
    			h4 = element("h4");
    			h4.textContent = "Modal que tal como estas";
    			t2 = space();
    			button1 = element("button");
    			button1.textContent = "×";
    			t4 = space();
    			div1 = element("div");
    			div1.textContent = "Modal body..";
    			t6 = space();
    			div2 = element("div");
    			button2 = element("button");
    			button2.textContent = "Close";
    			set_style(button0, "display", "none");
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "btn btn-primary");
    			attr_dev(button0, "data-toggle", "modal");
    			attr_dev(button0, "data-target", "#myModal");
    			attr_dev(button0, "id", "idVentana");
    			add_location(button0, file$2, 13, 0, 169);
    			attr_dev(h4, "class", "modal-title");
    			add_location(h4, file$2, 22, 8, 488);
    			attr_dev(button1, "type", "button");
    			attr_dev(button1, "class", "close");
    			attr_dev(button1, "data-dismiss", "modal");
    			add_location(button1, file$2, 23, 8, 550);
    			attr_dev(div0, "class", "modal-header");
    			add_location(div0, file$2, 21, 6, 453);
    			attr_dev(div1, "class", "modal-body");
    			add_location(div1, file$2, 27, 6, 670);
    			attr_dev(button2, "type", "button");
    			attr_dev(button2, "class", "btn btn-danger");
    			attr_dev(button2, "data-dismiss", "modal");
    			add_location(button2, file$2, 33, 8, 799);
    			attr_dev(div2, "class", "modal-footer");
    			add_location(div2, file$2, 32, 6, 764);
    			attr_dev(div3, "class", "modal-content");
    			add_location(div3, file$2, 18, 4, 390);
    			attr_dev(div4, "class", "modal-dialog");
    			add_location(div4, file$2, 17, 2, 359);
    			attr_dev(div5, "class", "modal");
    			attr_dev(div5, "id", "myModal");
    			add_location(div5, file$2, 16, 0, 324);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div4);
    			append_dev(div4, div3);
    			append_dev(div3, div0);
    			append_dev(div0, h4);
    			append_dev(div0, t2);
    			append_dev(div0, button1);
    			append_dev(div3, t4);
    			append_dev(div3, div1);
    			append_dev(div3, t6);
    			append_dev(div3, div2);
    			append_dev(div2, button2);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div5);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function abrir(...argumentos) {
    	idVentana.click();
    }

    function algo(...argumentos) {
    	idVentana.click();
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Ventana", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Ventana> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ abrir, algo });
    	return [abrir];
    }

    class Ventana extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { abrir: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Ventana",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get abrir() {
    		return abrir;
    	}

    	set abrir(value) {
    		throw new Error("<Ventana>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /*
    export function Productos(...argumentos){
    	return new _Productos({
    		target: document.querySelector( '#div2' ),
    		props:{argumentos}
    	});
    }*/

    let ventana = new Ventana({
    	target: document.querySelector( '#div2' ),
    	props: {argumentos: [2,3,4,5,5,5,6,7]}
    }); 

    let productos = new Productos({
    	target: document.querySelector( '#div1' )
    });

    //export default app;

    exports.productos = productos;
    exports.ventana = ventana;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

}({}));
//# sourceMappingURL=svelt.js.map
