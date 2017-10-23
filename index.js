const ax = require('axios');
const parse = require('parse-link-header');
const token = require('./token').token;
const zenhubToken = require('./zenhub.token').token;
const https = require('https');

function createAxRequest(method, url, params, headers) {
	return {
		method: method,
		params: params,
		url: url,
		headers: headers
	};
}

function createZHAxRequestForIssue(issue) {
	return {
		method: 'get',
		url: `https://zenhub.innovate.ibm.com/p1/repositories/97933/issues/${issue}`,
		headers: {
			'X-Authentication-Token': zenhubToken
		},
		httpsAgent: new https.Agent({ rejectUnauthorized: false })
	};
}

function makeAxRequest(req) {
	return ax(req);
}

const gheRequest_Ax = createAxRequest(
	'get',
	'https://github.ibm.com/api/v3/repos/WatsonSupplyChain/sci-ops/issues',
	{
		labels: 'defect',
		per_page: 100,
		page: 1
	},
	{
		'Authorization': `token ${token}`
	});

const gheRequest_Ax2 = createAxRequest(
	'get',
	'https://github.ibm.com/api/v3/repos/WatsonSupplyChain/sci-ops/issues',
	{
		labels: 'defect',
		per_page: 100,
		page: 2
	},
	{
		'Authorization': `token ${token}`
	});

function main(){
	let all = [];
	ax
	.all([makeAxRequest(gheRequest_Ax2)])
	.then(ax.spread((one, two) => {
		all = one.data.map(issue => issue.number);
		return Promise.resolve(all);
	}))
	.then(data => {
		console.log(`Got ${data.length} defects.`);
		let zenHubReqs = [];
		// let max =

		// rate limit 100 per min
		for (let i = 0; i < data.length; i++) {
			// console.log(data[i]);
			zenHubReqs.push(createZHAxRequestForIssue(data[i]));
		}

		return ax.all(zenHubReqs.map(req => ax(req)));
	})
	.then(data => {
		const estimateTotal = data.filter(res => res.data.estimate).map(res => {
			if (res.data.estimate) {
				return res.data.estimate.value;
			}
		});
		console.log(`${estimateTotal.length} with estimates`);
		console.log('Total estimate (PD):', estimateTotal.reduce((sum, val) => sum + val));
	})
	.catch(err => {
		console.log('some shit happened', Object.keys(err));
	});

}

main();

// @todo create proper class hierarchy
class GithubIssueRequest {

	constructor(){
		this.url = 'https://github.ibm.com/api/v3/repos/WatsonSupplyChain/sci-ops/issues';
		this.params = {
			labels: 'defect',
			page: 1,
			per_page: 50
		};

		this.headers = {
			'Authorization': `token ${token}`
		}
	}

	nextPage() {
		this.params.page = this.params.page + 1;
		return this;
	}

	createAxRequestObj(){
		return {
			method: 'get',
			params: this.params,
			url: this.url,
			headers: this.headers
		};
	}
}

async function getIssuesAsync(){
	let keepGoing = true;
	let allRequests = [];
	let allIssues = [];
	let linkHeader;
	let count = 0;
	const gheReq = new GithubIssueRequest();

	// get all issues
	while (keepGoing) {
		let req = ax(gheReq.createAxRequestObj());
		allRequests.push(await req);
		allIssues = allIssues.concat(allRequests[count].data);
		linkHeader = parse(allRequests[count].headers.linkHeader);

		// console.log(linkHeader);

		if (linkHeader && linkHeader.next) {
			gheReq.nextPage();
		} else {
			keepGoing = false;
		}
		// console.log(count);
		count++;
	}

	return allIssues;
}

// getIssuesAsync().then(data => {
// 	console.log(data.length);
// }).catch(err => {
// 	console.log('shit', err);
// });
