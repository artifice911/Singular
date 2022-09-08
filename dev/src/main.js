import componente from "./componente.svelte";

var app = {};

app.componente = function(html, ...param ){
	return new componente({target: html,props: {param}});
};

export default app;
