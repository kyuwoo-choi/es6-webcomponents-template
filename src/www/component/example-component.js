'use strict';

class ExampleComponent extends HTMLElement {
    constructor () {
        super();
        console.log('ExampleComponent constructor');
    }

    createdCallback () {
        var shadow = this.createShadowRoot();

        var template = this.ownerDocument.querySelector('#example-component')
            || this.ownerDocument.querySelector('link[rel="import"]').import.querySelector('#example-component');
        var templateInstance = this.ownerDocument.importNode(template.content, true);

        shadow.appendChild(templateInstance);
    }

    attachedCallback () {
        console.log('ExampleComponent attached');
    }

    detachedCallback () {
        console.log('ExampleComponent detached');
    }

    attributeChangedCallback (attr, oldVal, newVal) {
        console.log('ExampleComponent attribute chanaged ' + attr + ', ' + oldVal + ', ' + newVal);
    }

    yes () {
        console.log('say yes!');
    }
}

document.registerElement('example-component', {
    prototype: ExampleComponent.prototype
});

export default ExampleComponent;
