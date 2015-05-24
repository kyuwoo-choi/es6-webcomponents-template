'use strict';

class RequiredComponent extends HTMLElement {
    constructor () {
        super();
        console.log('RequiredComponent constructor');
    }

    createdCallback () {
        var shadow = this.createShadowRoot();

        var template = this.ownerDocument.querySelector('#required-component')
            || this.ownerDocument.querySelector('link[rel="import"]').import.querySelector('#required-component');
        var templateInstance = this.ownerDocument.importNode(template.content, true);

        shadow.appendChild(templateInstance);
    }

    attachedCallback () {
        console.log('RequiredComponent attached');
    }

    detachedCallback () {
        console.log('RequiredComponent detached');
    }

    attributeChangedCallback (attr, oldVal, newVal) {
        console.log('RequiredComponent attribute chanaged ' + attr + ', ' + oldVal + ', ' + newVal);
    }

    yes () {
        console.log('say yes!');
    }
}

document.registerElement('required-component', {
    prototype: RequiredComponent.prototype
});

export default RequiredComponent;
