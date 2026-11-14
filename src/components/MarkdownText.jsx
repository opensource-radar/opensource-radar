import { parseMarkdown } from "../lib/markdown";

function Inline({ pieces }) {
  return pieces.map((piece, index) => {
    if (piece.type === "link") {
      return (
        <a key={index} href={piece.href} target="_blank" rel="noopener noreferrer">
          {piece.text}
        </a>
      );
    }
    if (piece.type === "code") return <code key={index}>{piece.text}</code>;
    if (piece.type === "bold") return <strong key={index}>{piece.text}</strong>;
    return piece.text;
  });
}

// Renders Markdown as plain React elements, never as HTML.
function MarkdownText({ text, base }) {
  return parseMarkdown(text, base).map((block, index) => {
    if (block.type === "heading") {
      const Heading = `h${block.level}`;
      return (
        <Heading key={index}>
          <Inline pieces={block.inline} />
        </Heading>
      );
    }
    if (block.type === "code") return <pre key={index}>{block.text}</pre>;
    if (block.type === "quote") {
      return (
        <blockquote key={index}>
          <Inline pieces={block.inline} />
        </blockquote>
      );
    }
    if (block.type === "list") {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <Inline pieces={item} />
            </li>
          ))}
        </List>
      );
    }
    return (
      <p key={index}>
        <Inline pieces={block.inline} />
      </p>
    );
  });
}

export default MarkdownText;
