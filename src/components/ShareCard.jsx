import { useEffect, useRef, useState } from "react";
import CopyButton from "../devagents/CopyButton";
import {
  drawShareCard,
  linkedInShareUrl,
  shareHeadline,
  shareText,
  xShareUrl,
} from "../shareCard";

// A picture to post after a pull request is merged, with ways to share it.
// It's made in the browser, so nothing is uploaded anywhere.
function ShareCard({ pullRequest, login, first }) {
  const canvasRef = useRef(null);
  const [image, setImage] = useState(null);
  const headline = shareHeadline(first);
  const text = shareText(pullRequest, first);
  const fileName = `merged-${pullRequest.repo.replace("/", "-")}-${pullRequest.number}.png`;

  useEffect(() => {
    const canvas = canvasRef.current;
    const drawn = drawShareCard(canvas, { ...pullRequest, headline, login });
    if (!drawn) return;
    canvas.toBlob((blob) => {
      if (blob) setImage({ blob, url: URL.createObjectURL(blob) });
    }, "image/png");
  }, [pullRequest, headline, login]);

  useEffect(() => () => image && URL.revokeObjectURL(image.url), [image]);

  const file = image ? new File([image.blob], fileName, { type: "image/png" }) : null;
  const canShareFile = Boolean(file && navigator.canShare?.({ files: [file] }));

  return (
    <div className="share-card">
      <p className="share-card-headline">{headline}</p>
      <canvas ref={canvasRef} hidden />
      {image && (
        <img
          className="share-card-image"
          src={image.url}
          alt={`${headline}: "${pullRequest.title}" in ${pullRequest.repo}`}
        />
      )}
      <div className="share-card-actions">
        {canShareFile && (
          <button
            type="button"
            className="primary-button"
            onClick={() => navigator.share({ files: [file], text }).catch(() => {})}
          >
            Share
          </button>
        )}
        {image && (
          <a className="secondary-button" href={image.url} download={fileName}>
            Download image
          </a>
        )}
        <a className="secondary-button" href={xShareUrl(pullRequest, first)} target="_blank" rel="noopener noreferrer">
          Post on X ↗
        </a>
        <a className="secondary-button" href={linkedInShareUrl()} target="_blank" rel="noopener noreferrer">
          Share on LinkedIn ↗
        </a>
        <CopyButton text={text} label="Copy text" className="secondary-button" />
      </div>
      <p className="share-card-tip">
        LinkedIn only takes the link, so download the image and paste the text into your post.
      </p>
    </div>
  );
}

export default ShareCard;
