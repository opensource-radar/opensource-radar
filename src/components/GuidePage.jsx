import { CONTRIBUTION_GUIDE_URL, isPlainClick } from "../lib/links";
import { GUIDE } from "../lib/seoPages";
import { splitGlossaryBlocks } from "../lib/glossary";
import GlossaryText from "./Glossary";
import Icon from "./Icon";
import SevenDays from "./SevenDays";
import { LanguageLinks } from "./SearchHelp";

function GuidePage({ onBack }) {
  // Each open-source word is explained the first time it appears on the page.
  const blocks = splitGlossaryBlocks([...GUIDE.steps.map((step) => step.detail), ...GUIDE.tips.map((tip) => tip.answer)]);
  const stepParts = blocks.slice(0, GUIDE.steps.length);
  const tipParts = blocks.slice(GUIDE.steps.length);
  return (
    <article className="aboutpage">
      <a
        className="aboutpage-back"
        href="/"
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          onBack();
        }}
      >
        <Icon name="arrowLeft" />
        Back to search
      </a>

      <header className="aboutpage-intro">
        <p className="eyebrow">BEGINNER’S GUIDE</p>
        <h1>{GUIDE.heading}</h1>
        <p className="aboutpage-lead">{GUIDE.lead}</p>
      </header>

      <section className="aboutpage-section">
        <h2>The seven steps</h2>
        <ol className="aboutpage-steps">
          {GUIDE.steps.map(({ name }, index) => (
            <li key={name} className="guide-step">
              <span className="aboutpage-step-number" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <strong>{name}</strong>
                <span>
                  <GlossaryText parts={stepParts[index]} />
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <SevenDays />

      <section className="aboutpage-section">
        <h2>If you get stuck</h2>
        <div className="search-help-grid">
          {GUIDE.tips.map(({ question }, index) => (
            <div key={question} className="search-help-item">
              <h3>{question}</h3>
              <p>
                <GlossaryText parts={tipParts[index]} />
              </p>
            </div>
          ))}
        </div>
        <p className="search-help-more">
          Want more detail? See{" "}
          <a href={CONTRIBUTION_GUIDE_URL} target="_blank" rel="noopener noreferrer">
            GitHub’s own guide to contributing
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </p>
      </section>

      <LanguageLinks />
    </article>
  );
}

export default GuidePage;
