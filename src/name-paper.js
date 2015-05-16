'use strict';

var namePaper = Object.create(HTMLElement.prototype);
namePaper.createdCallback = function () {
    var shadow = this.createShadowRoot();

    var username = this.getAttribute('username');
    var service = this.getAttribute('service');
    var url = 'http://avatars.io/' + service + '/' + username;

    var img = document.createElement('img');
    img.setAttribute('src', url);

    var template = this.ownerDocument.querySelector('link[rel="import"]').import.querySelector('#name-paper');
    var templateInstance = this.ownerDocument.importNode(template.content, true);

    shadow.appendChild(templateInstance);
};
namePaper.attachedCallback = function () {
    console.log('attached');
};
namePaper.yes = function () {
    alert('yes');
};
document.registerElement('name-paper', {
    prototype: namePaper
});

class NamePaper {
    constructor () {
    }

    test () {
        console.log('a class test');
    }
}

//export default NamePaper;
