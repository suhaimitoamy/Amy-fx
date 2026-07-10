async function sha256Hex(message){return message;}
async function validateCode(code){return {ok:true,label:'VIP'};}
async function requireLogin(){
    document.documentElement.classList.add('is-authed');
    return true;
}
function logout(){
    location.href=typeof ROOT_PATH !== 'undefined' ? ROOT_PATH+'index.html' : 'index.html';
}
