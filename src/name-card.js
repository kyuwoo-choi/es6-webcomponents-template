'use strict';

var nameCard = Object.create(HTMLElement.prototype);
nameCard.createdCallback = function () {
    var shadow = this.createShadowRoot();

    var username = this.getAttribute('username');
    var service = this.getAttribute('service');
    var url = 'http://avatars.io/' + service + '/' + username;

    var img = document.createElement('img');
    img.setAttribute('src', url);

    var template = this.ownerDocument.querySelector('link[rel="import"]').import.querySelector('#name-card');
    var templateInstance = this.ownerDocument.importNode(template.content, true);

    shadow.appendChild(templateInstance);
};
nameCard.attachedCallback = function () {
    console.log('attached');
};
nameCard.yes = function () {
    alert('yes 2');
};
document.registerElement('name-card', {
    prototype: nameCard
});

class NameCard {
    constructor () {
    }

    test () {
        console.log('a class test');
    }
}

//export default NameCard;
