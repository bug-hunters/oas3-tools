export class XmlOptions {
    public tagNameProcessors: 'array';
    public valueProcessors: 'array';
    public sanitiseProcessors: (req, res, next) => any;

    constructor(tagNameProcessors: 'array', valueProcessors: 'array', sanitiseProcessors: (req, res, next) => any)
    {
        this.tagNameProcessors = tagNameProcessors;
        this.valueProcessors = valueProcessors;
        this.sanitiseProcessors = sanitiseProcessors;
    }
}