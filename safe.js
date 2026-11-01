window.safeUrl=function(u){try{var x=new URL(String(u),location.href);return /^https?:$/.test(x.protocol)?x.href:"#"}catch(e){return "#"}};
