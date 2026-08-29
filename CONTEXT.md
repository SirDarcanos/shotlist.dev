# shotlist

shotlist is an annotated screenshot automation tool for documentation. Drift checking supports that purpose rather than defining shotlist as a general-purpose visual regression testing product.

## Language

**Documentation owner**:
A developer or technical writer responsible for keeping product documentation and its UI screenshots current in a repository.
_Avoid_: Frontend test engineer, general website visitor

**Adoption path**:
The observable progression from viewing the first tutorial, to downloading the example, to copying the install command. It measures adoption intent rather than a completed installation.
_Avoid_: Installed user, active project

**Markdown alternate**:
A generated, non-canonical Markdown representation of an HTML page for agents to read. The HTML page remains the authored and indexable source of truth.
_Avoid_: Markdown page, duplicate documentation

**Annotated screenshot automation**:
The product category: repeatable documentation screenshots whose callouts and captured state are described as data.
_Avoid_: Visual regression testing tool

**Drift checking**:
Comparison of a regenerated screenshot with its committed image to report when the documentation no longer matches the interface.
_Avoid_: General-purpose visual regression testing
