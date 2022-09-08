<script>
    export let param; export function vs(update){}
    let [info] = param;
</script>

<style>
	h1 {
		color:orange
	}
</style>

<section class="py-3 text-center container">
	<div class="row py-lg-5">
		<div class="col-lg-6 col-md-8 mx-auto">
			<h1 class="fw-light">{info.titulo}</h1>
			<p class="lead text-muted">Svelte is a free and open-source front end compiler created by Rich Harris and maintained by the Svelte core team members.</p>
		</div>
	</div>
</section>



