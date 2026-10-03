import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

const layoutPath = path.resolve(__dirname, '..', '[locale]', 'layout.tsx');
const source = readFileSync(layoutPath, 'utf8');
const sourceFile = ts.createSourceFile(layoutPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function jsxTag(element: ts.JsxElement | ts.JsxSelfClosingElement): string {
  return (ts.isJsxElement(element) ? element.openingElement.tagName : element.tagName).getText(sourceFile);
}

describe('LocaleLayout theme bootstrap', () => {
  it('leaves <head> to Next and puts beforeInteractive Script first in <body>', () => {
    const elements: Array<ts.JsxElement | ts.JsxSelfClosingElement> = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node);
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    const html = elements.find((element) => jsxTag(element) === 'html');
    expect(html && ts.isJsxElement(html)).toBe(true);
    if (!html || !ts.isJsxElement(html)) throw new Error('LocaleLayout doit rendre un élément <html>.');

    const htmlChildren = html.children.filter((child): child is ts.JsxElement | ts.JsxSelfClosingElement =>
      ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child),
    );
    expect(htmlChildren.map(jsxTag)).not.toContain('head');
    const body = htmlChildren.find((element) => jsxTag(element) === 'body');
    expect(body && ts.isJsxElement(body)).toBe(true);
    if (!body || !ts.isJsxElement(body)) throw new Error('LocaleLayout doit rendre un élément <body>.');

    const bodyChildren = body.children.filter((child): child is ts.JsxElement | ts.JsxSelfClosingElement =>
      ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child),
    );
    expect(bodyChildren.slice(0, 2).map(jsxTag)).toEqual(['Script', 'NextIntlClientProvider']);

    const script = bodyChildren[0];
    const attributes = ts.isJsxSelfClosingElement(script) ? script.attributes.properties : script.openingElement.attributes.properties;
    const attribute = (name: string) => attributes.find((property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText(sourceFile) === name,
    );
    expect(attribute('src')?.initializer?.getText(sourceFile)).toBe('"/theme-init.js"');
    expect(attribute('strategy')?.initializer?.getText(sourceFile)).toBe('"beforeInteractive"');

    const htmlAttributes = html.openingElement.attributes.properties.map((property) => property.getText(sourceFile));
    expect(htmlAttributes).toContain('suppressHydrationWarning');
  });
});
