import { memo, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { ContentSearchBar } from "@/components/base/content-search-bar";

/** 对话内搜索条（⌘F / Ctrl+F 打开）：输入即匹配，Enter 下一个、
 *  Shift+Enter 上一个、Esc 关闭——与浏览器页内查找一致。
 *  展示壳与 Markdown 预览共用 `ContentSearchBar`。 */
export const TimelineSearchBar = memo(function TimelineSearchBar({
  query,
  onQueryChange,
  current,
  total,
  onPrev,
  onNext,
  onClose,
  inputRef,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  /** 当前命中序号（0 基）；无命中时为 0。 */
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  inputRef: MutableRefObject<HTMLInputElement | null>;
}) {
  const { t } = useTranslation();
  return (
    <ContentSearchBar
      query={query}
      onQueryChange={onQueryChange}
      current={current}
      total={total}
      onPrev={onPrev}
      onNext={onNext}
      onClose={onClose}
      inputRef={inputRef}
      placeholder={t("chat.searchPlaceholder")}
      noResultsLabel={t("chat.searchNoResults")}
      previousLabel={t("chat.searchPrevMatch")}
      nextLabel={t("chat.searchNextMatch")}
      closeLabel={t("chat.searchClose")}
    />
  );
});
