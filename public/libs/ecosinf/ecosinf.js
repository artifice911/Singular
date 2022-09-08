
const sistema = (function(){

	var tiempos = [], config = {}, modelos={};
	
	function toElement(elemento,modelo){ // {v: true, T: "B", D: 1}
		Object.defineProperty(elemento,'$',{value:elemento.$||{}, enumerable:false});
		Object.defineProperty(elemento,'_id',{value:elemento._id, enumerable:false, writable:false});
		for(let c in elemento){
			// {v: true, T: "B", D: 1}
			switch(modelo[c].T){
				case 'B': elemento[c] = elemento[c]?true:false; break;
				case 'A': case 'O':  elemento[c] = JSON.parse(elemento[c]); break;
				case 'D': elemento[c] = new Date(elemento[c]); break;
			}
		}
	}
	
	function toModelo(dato,modelo){
		if(Array.isArray(dato)){
			for(let p in dato){
				toElement(dato[p],modelo);	
			}
		}else{
			toElement(dato,modelo);
		}
	}
	
	function send(u,p,f,e){
		var xhttp, tt = new Date().getTime();
				
		if (window.XMLHttpRequest) {
			// code for modern browsers
			xhttp = new XMLHttpRequest();
		} else {
			// code for old IE browsers
			xhttp = new ActiveXObject("Microsoft.XMLHTTP");
		}
		xhttp.ontimeout = function(){e(0)};
		xhttp.onreadystatechange = function() {
			if (this.readyState == 4 && this.status == 200) {
				let t, r, m = xhttp.responseText;
				if(/^[Ø×]$/.test(r)){
					e(r);
				}else{
					[t,r] = JSON.parse(xhttp.responseText);
					if(u==='_'){
						config = r;
						modelos = r.m;
					}else{
						m = (typeof r)[0]=='o'?r.$ || (r[0]||'').$:0;
						if(m) toModelo(r,modelos[m.y]);
						tiempos.push({u:u,l:(new Date().getTime())-tt,s:(t[0]* 1000000000 + t[1])/1000000});
					}
				}
				f(r);
			}
		};
		//console.log(u+p)
		xhttp.open("POST",u+p, true);
		xhttp.send();
	}

	function argToParam(arg){
		var p,A=[],v,i;		
		for(p in arg){
			v = arg[p];
			if((typeof v)[0]=='o'&&v.$&&v._id){
				i = v._id;
				v = JSON.parse(JSON.stringify(v));
				v._id = i;
			}
		  A.push(`${p}=${JSON.stringify(v)}`);
		}
		return A.length?'?'+A.join('&'):'';
	}

	function arrToThis(ctx, ruta, tipos, url){
		var n = ruta.shift();
		if(ruta.length){
			if(!ctx[n])ctx[n] = {};
			arrToThis(ctx[n], ruta, tipos, url);
		}else{
			ctx[n] = function(){
				return new Promise((r,R)=>{
					send(url,argToParam(arguments),r,R);
				});
			};	
		}
	}

	send('_','',v => {
		var e, arr = v.r;
		for(e of arr){
			arrToThis(this, e[0].split('/'), e[1], e[0]);
		}
		console.log(this.v=v);
	});
	
	return this;
	
}).bind({})();





