async function handleError(context_map) {
    context_map.solution = "Great! We've found a solution.";
    return { context_map, stop: false };
}

module.exports = { handleError };
