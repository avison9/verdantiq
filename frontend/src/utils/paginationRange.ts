import _ from "lodash";

export const paginationRange = (
  totalPage: number,
  currentPage: number,
  siblings: number
) => {
  let totalPageSiblingsInArray = 7 + siblings;
  if (totalPageSiblingsInArray >= totalPage) {
    return _.range(1, totalPage + 1);
  }

  let leftSiblingsIndex = Math.max(currentPage - siblings, 1);
  let rightSiblingsIndex = Math.min(currentPage + siblings, totalPage);
  let showLeftDots = leftSiblingsIndex > 2;
  let showRightDots = rightSiblingsIndex < totalPage - 2;

  if (!showLeftDots && showRightDots) {
    let leftItemCounts = 3 + 2 * siblings;
    let leftRange = _.range(1, leftItemCounts + 1);

    return [...leftRange, " ...", totalPage];
  } else if (showLeftDots && !showRightDots) {
    let rightItemCounts = 3 + 2 * siblings;
    let rightRange = _.range(totalPage - rightItemCounts + 1, totalPage + 1);

    return [1, "... ", ...rightRange];
  } else {
    let middleRange = _.range(leftSiblingsIndex, rightSiblingsIndex + 1);

    return [1, "... ", ...middleRange, "... ", totalPage];
  }
};
