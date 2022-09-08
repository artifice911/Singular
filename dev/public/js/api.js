
window.onload = function(){
	document.body.style.display = "";
	server({render:(t,f) => {
		if (`${t}.html` === (document.location.pathname.split('/').pop() || 'index.html'))
			f();
	}}, app);	
}
