function ProjectDashboard(){

    const wikiSite = "https://www.appropedia.org/"; 
    let excludeBots = true; //gonna make this toggleable
    let showTimestamps, showPageEditCount, showUserPagesEditedCount = true;
    let currentCat = "";
    var continuing = false;
    let continueString = "";
    var siteArray = [];
    var userArray = [];
    var minorArray = []; //minor edit array
    var recentUserArray = [];
    var mostRecentRevision = 0;
    
    let mainApiLink = ""; //gets constructed
    let proxy = "";
    
    let totalContribs = 0;
    let totalUnique = 0;
    let allUnique = [];
    let allUniqueStrings = [];
    let foundBots = [];
    let recentUnique = [];
    let topUserPage = "";
    let topUserPageCount = 0;
    
    var hashParams = window.location.hash.substring(1).split('&'); // substr(1) to remove the `#`
    
    for(var i = 0; i < hashParams.length; i++){
        if(hashParams.length == 0 || hashParams[0] == "") {
            setErrorMessage("No category inputted. Please fix url.");
            break;
        };
        currentCat = decodeURIComponent(hashParams[0]);
    }
    
    function fetchWikiExtract(catGrab){ //builds api link with category as input
        console.log("FETCHED");
        let wikiParams = 'w/api.php?action=query'
        + '&generator=categorymembers'
        + '&gcmlimit=100'
        + '&gcmtitle=Category:'
        + catGrab
        + '&prop=id'
        + '&prop=revisions'
        + '&pcexcludegroup=bot'
        + "&format=json"
        + '&origin=*'
        if(continuing) wikiParams += continueString += gsmContinueString;
        return wikiSite + wikiParams;
    }
    
    async function setDisplay(){
        fetch(proxy + mainApiLink).then(response => response.json()).then(//get data for category
            data => {
                if (data.continue != null) { //this sets up continue at end of promise chain
                    continueString = "&continue=" + data.continue.continue;
                    gsmContinueString = "&gcmcontinue=" + data.continue.gcmcontinue;
                    continuing = true;
                    mainApiLink = fetchWikiExtract(currentCat);
                } else {
                    continuing = false
                }
                let bar = Object.keys(data.query.pages);
                for(i = 0; i < bar.length; i++){
                    //get data for contributors
                    fetch(genIDBasedAPILinkContributors(bar[i])).then(response => response.json()).then(//get data for page
                        data => {
                            let allPages = data.query.pages;
                            for (let page in allPages) {
                                let currentTitle = allPages[page].title
                                let contributors = allPages[page].contributors;
                                if (contributors!=null) {
                                    for(j = 0; j < contributors.length; j++){
                                        let currentID = contributors[j].userid;
                                        if(allUnique.indexOf(currentID) == -1){ //if current user not yet recorded
                                            let currentName = contributors[j].name;
                                            userArray.push([currentName, 1, currentID]);
                                            allUnique.push(currentID); //more efficient than scanning complex array every time
                                            allUniqueStrings.push(currentName);
                                        } else {
                                            userArray[indexOfUser(userArray, currentID)][1]++; //add 1 to count part of user data
                                        }
                                    }
                                }   
                                setEdits(currentTitle);
                                postUsers();
                                postMinors();
                                postRecentUsers();
                            }; 
                        }).catch(error => {console.error(error);})
                        //get data for revisions
                        fetch(genIDBasedAPILinkRevisions(bar[i])).then(response => response.json()).then(//get data for page
                            data => {
                                let allPages = data.query.pages;
                                for (let page in allPages) { //not checking uniqueness on users in the 5 revisions
                                    let revisions = allPages[page].revisions;
                                    for(j = 0; j < revisions.length; j++){
                                        let currentLastRevUser = revisions[j].user;
                                        let currentLastRev = revisions[j].revid;
                                        let currentTimestamp = revisions[j].timestamp;
                                        currentTimestamp = cleanTimestamp(currentTimestamp);
                                        if(recentUnique.indexOf(currentLastRevUser) != -1) {
                                            mostRecentEditCheck(currentLastRevUser, currentLastRev, currentTimestamp); //check recency compared to logged revid, then push
                                        } else { // if not already listed as a recent user
                                            recentUserArray.push([currentLastRevUser, currentLastRev, currentTimestamp]) //push into array no verification
                                            recentUnique.push(currentLastRevUser);
                                        }
                                    }
                                }   
                            }).catch(error => {console.error(error);})
                }   
                //get data for revisions, currently very cheap but janky
                let catPages = data.query.pages;
                console.log(catPages);
                for (let page in catPages){ 
                    let revs = catPages[page].revisions;
                    let currentLastRev = revs[0].revid;
                    let currentLastRevUser = revs[0].user;
                    let currentTimestamp = revs[0].timestamp;
                    currentTimestamp = cleanTimestamp(currentTimestamp);
                    let currentTitle = catPages[page].title;
                    if (currentLastRevUser != "Translations bot") minorArray.push([currentTitle, currentLastRevUser, currentLastRev, currentTimestamp]); //should find way to delay & check against users
                }
            }).then(function(){ //recur to continue
                if(continuing) setDisplay();
            })
            .catch(error => {
                setErrorMessage("Unknown Category or API Error");
                console.error(error);
            })
    }
    
    
    function cleanTimestamp(time){ //both of these clean methods are slightly slower than possible but written clearer than otherwise 
        let newTimestamp = time.substring(0, 10) + " " + time.substring(11, 19);
        return newTimestamp;
    }
    
    function toggleTimestamps(){
        showTimestamps = !showTimestamps; //flip boolean
        postRecentUsers();
        postMinors();
    }
    
    function togglePageEditCount(){
        showPageEditCount = !showPageEditCount; //flip boolean
        postEdits();
    }
    
    function toggleUserPagesEditedCount(){
        showUserPagesEditedCount = !showUserPagesEditedCount; //flip boolean
        postUsers();
    }
    
    //calls all helper toggle functions
    function toggleExtraData(){
        toggleTimestamps();
        togglePageEditCount();
        toggleUserPagesEditedCount();
    }
    
    //helper function to add toggle function to button
    function addFunctiontoToggleButton(){
        document.getElementById('toggleData').addEventListener('click', toggleExtraData) //additional instances get discarded, no need to check
    }
    
    //sets name of category in heading & subhead, adds link to subhead
    function setCatName(){
        document.getElementById('category').textContent = "Dashboard for project " + currentCat;
        document.getElementById('subhead').textContent = "(based on Category:" + currentCat  + ")";
        document.getElementById('subhead').href = "https://www.appropedia.org/Category:" + currentCat;
    }
    
    //generic error message function (changes subhead), changes styling & removes link from subhead
    function setErrorMessage(msg){
        document.getElementById('subhead').textContent = msg;
        document.getElementById('subhead').removeAttribute('href');
        document.getElementById('subhead').classList.add("errormessage");
        document.getElementById('toggleData').classList.add("invisible");
    }
    
    function postMinors(){ //minors being any revision to a page, no filtering for logs
        minorArray.sort(function(a,b) {
            return a[2]-b[2]
        });
        minorArray.reverse();
        let container = document.querySelector('#minorlist')
        container.innerHTML = ''; //in case of refresh
        minorArray.forEach(e => {
            let newListObject = document.createElement("a");
            let newText = document.createTextNode(e[0]);
            newListObject.appendChild(newText);
            newListObject.href = wikiSite + encodeURI(e[0]);//
            container.appendChild(newListObject);
            if (showTimestamps) { //all timestamp related
                let newListObject2 = document.createElement("a");
                let newText2 = document.createTextNode(': ' + e[3]);
                newListObject2.appendChild(newText2);
                container.appendChild(newListObject2);
            }
            container.appendChild(document.createElement("br"));
        });
    }
    
    function postRecentUsers(){ //recent users and their most recent edit, shallow search based off of recent revisions to pages found above
        recentUserArray.sort(function(a,b) {
            return a[1]-b[1]
        });
        recentUserArray.reverse();
        let container = document.querySelector('#recentlist')
        container.innerHTML = ''; //in case of refresh
        recentUserArray.forEach(e => {
            if(allUniqueStrings.indexOf(e[0]) == -1) return; //stops those not logged as contributors ALSO BLOCKs NON-LOGGED IN
            let newListObject = document.createElement("a");
            let newText = document.createTextNode(e[0]);
            newListObject.appendChild(newText);
            newListObject.href = wikiSite + 'User:' + encodeURI(e[0]);
            container.appendChild(newListObject);
            if (showTimestamps) { //all timestamp related
                let newListObject2 = document.createElement("a");
                let newText2 = document.createTextNode(': ' + e[2]);
                newListObject2.appendChild(newText2);
                container.appendChild(newListObject2);
            }
            container.appendChild(document.createElement("br"));
        });
    }
    
    //gets index of user for displayTop() method
    function indexOfUser(arr, id){
        for(let index = 0; index < arr.length; index++){
            if (arr[index][2] == id) return index;
        }
        return -1;
    }
    
    //revisions prop doesn't give us id but rather name so we use this
    function indexOfUserRecent(arr, name){ 
        for(let index = 0; index < arr.length; index++){
            if (arr[index][0] == name) return index;
        }
        return -1;
    }
    
    //check if this user and its matching revision id are the most recent of that user (also functions for timestamp deep ver)
    function mostRecentEditCheck(user, id, time){ 
        userIndex = indexOfUserRecent(recentUserArray, user);
        let currentMostRecentID =  recentUserArray[userIndex][1];
        if (currentMostRecentID < id) {
            recentUserArray[userIndex][1] = id;
            recentUserArray[userIndex][2] = time;
        }
    }
    
    //takes all top user data and puts onto site
    function postUsers(){ 
        userArray.sort(function(a,b) {
            return a[1]-b[1]
        });
        userArray.reverse();
        let container = document.querySelector('#userlist')
        container.innerHTML = ''; 
        userArray.forEach(e => {
            let newListObject = document.createElement("a");
            let newText = document.createTextNode(e[0]);
            newListObject.appendChild(newText);
            newListObject.href = wikiSite + 'User:' + encodeURI(e[0]);
            container.appendChild(newListObject);
            if (!showUserPagesEditedCount) {
                let newListObject2 = document.createElement("a");
                let newText2 = document.createTextNode(': ' + e[1]);
                newListObject2.appendChild(newText2);
                container.appendChild(newListObject2);
            }
            container.appendChild(document.createElement("br"));
        });
    }
    
    //gets page edits and pushes to array of them
    async function setEdits(page){ 
        let json = await getEdits(page);
        if(json.count>0)totalContribs+=json.count; //keeping for now in case we want it
        let tempPage = page;
        let tempCount = json.count;
        siteArray.push([tempPage, tempCount]) //have to add href to each child with wikiSite + encodeURI(page or whatever nested page title);
        postEdits();
    }
    
    //gets data for page edits 
    async function getEdits(page){ 
        await new Promise(r => setTimeout(r, 200)); //this prevents previous overloading error
        let link = proxy + wikiSite + "w/rest.php/v1/page/" + encodeURIComponent(page) +"/history/counts/edits"
        try {
            var response = await fetch(link, {
                method: "GET"
            });
            var data = await response.json();
            return data;
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    }
    
    function postEdits(){ //takes all top edited articles and puts onto site
        siteArray.sort(function(a,b) {
            return a[1]-b[1]
        });
        siteArray.reverse();
        let container = document.querySelector('#articlelist')
        container.innerHTML = ''; 
        siteArray.forEach(e => {
            let newListObject = document.createElement("a");
            let newText = document.createTextNode(e[0]);
            newListObject.appendChild(newText);
            newListObject.href = wikiSite + encodeURI(e[0]);
            container.appendChild(newListObject);
            if(showPageEditCount) {
                let newListObject2 = document.createElement("a");
                let newText2 = document.createTextNode(': ' + e[1]);
                newListObject2.appendChild(newText2);
                container.appendChild(newListObject2);
            }
            container.appendChild(document.createElement("br"));
        });
    }
    
    //finds all contributors in a page with pageid
    function genIDBasedAPILinkContributors(id){ 
        if (excludeBots) return proxy + wikiSite + "w/api.php?action=query&prop=contributors&pageids=" + id + "&format=json&pcexcludegroup=bot"
        return proxy + wikiSite + "w/api.php?action=query&prop=contributors&pageids=" + id + "&format=json"
    }
    
    //finds past 5 revisions on a page with pageid (for use in deep recent user search)
    function genIDBasedAPILinkRevisions(id){
        return proxy + wikiSite + "w/api.php?action=query&prop=revisions&pageids=" + id + "&rvlimit=5&rvprop=ids|timestamp|user&format=json";
    }
    
    this.setLinkToInput = async function(){ //sets mainApiLink to inputted category, then dumps info on page
        addFunctiontoToggleButton(); //gives data toggle event handler
        setCatName(); //sets cat name from url data
        mainApiLink = fetchWikiExtract(currentCat); //creates api link
        continuing = true; //set up to help stop double clicks
        setDisplay(mainApiLink)
    }
}

window.onload = function() {
    const dashboard = new ProjectDashboard();
    if (dashboard.currentCat!="") dashboard.setLinkToInput(); //if category put in from url, go
}