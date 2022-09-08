


const INFO = {
    titulo:'Componente DATO'
};

function server(api, app){

	//------------------------------------------------------------------
	// Area de trabajo
	//------------------------------------------------------------------
	
	api.render('plantilla', (info=INFO) => {
		app.componente(document.querySelector('main'), info);
	});

	api.render('index', (info=INFO) => {

	});


}
