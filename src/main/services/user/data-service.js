/**
 * @class DataService
 * @description A service for storing and retrieving user data for learning purposes.
 */
class DataService {
    constructor() {
        // TODO: Implement data storage
    }
}

let dataService = null;

/**
 * @description Get the singleton data service instance.
 * @returns {DataService} The data service instance.
 */
function getDataService() {
    if (!dataService) {
        dataService = new DataService();
    }
    return dataService;
}

module.exports = { getDataService };
