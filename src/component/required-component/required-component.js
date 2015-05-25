'use strict';

class RequiredComponent extends HTMLElement {
    constructor () {
        super();
        console.log('RequiredComponent constructor');
    }

    createdCallback () {
        var findTemplate = function (dom, selector) {
            var foundTemplate = dom.querySelectorAll(selector);
            if (foundTemplate.length > 0) {
                return foundTemplate[ 0 ];
            }
            var links = dom.querySelectorAll('link[rel="import"]');
            for (var i = 0; i < links.length; i += 1) {
                foundTemplate = findTemplate(links[ i ].import, selector);
                if (foundTemplate !== null) {
                    return foundTemplate;
                }
            }
            return null;
        };
        var shadow = this.createShadowRoot();

        var template = this.ownerDocument.querySelector('#required-component')
            || findTemplate(this.ownerDocument.querySelector('link[rel="import"]').import, '#required-component');

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
