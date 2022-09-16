const db = require("../db");
const express = require("express");
const multer = require("multer");
const documentRoute = require("./document");

const upload = multer({
  dest: "public/uploads",
  limits: {
    fileSize: 30000000,
  },
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
      return cb(new Error("Please upload an image"));
    }
    cb(undefined, true);
  },
});
const router = express.Router();

/*
function fetchProjects(req, res, next) {
  db.all("SELECT * FROM projects", function (err, items) {
    res.locals.projects = items; //projects è il nome di una variabile che ho appena creato
    next();
  });
}
*/

function fetchProjects(req, res, next) {
  db.all("SELECT * FROM projects", function (err, items) {
    res.locals.projects = items; //projects è il nome di una variabile che ho appena creato
    res.locals.searchValue = "";

    next();
  });
}

//per selezionare un progetto con quel id
function fetchProjectsById(req, res, next) {
  const projectId = req.params.id;

  db.all(
    "SELECT * FROM projects WHERE id=?",
    [projectId],
    function (err, project) {
      res.locals.project = project[0];

      next();
    }
  );
}
function fetchFollowById(req, res, next) {
  const projectId = req.params.id;
  const userId =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    parseInt(req.session.passport.user.id);

  if (!userId) return next();

  db.all(
    "SELECT * FROM follow WHERE user=? AND id_prog=?",
    [userId, projectId],
    function (err, follow) {
      const isFollow = follow && follow.length ? true : false;

      res.locals.project = { ...res.locals.project, isFollow: isFollow };

      next();
    }
  );
}
function fetchCommentsById(req, res, next) {
  const projectId = req.params.id;

  db.all(
    "SELECT * FROM documents_comments WHERE project_id=?",
    [projectId],
    function (err, comments) {
      res.locals.comments = comments;

      next();
    }
  );
}

//creo progetto
router.post(
  "/createProject",
  upload.single("image"),
  async function (req, res, next) {
    const filename = "/uploads/" + req.file.filename;

    if (!req.file) {
      res.status(401).json({ error: "Please provide an image" });
    }

    db.run(
      "INSERT INTO projects (owner_id,title,description,category,image,author_name) VALUES (?,?,?,?,?,?)",
      [
        req.session.passport.user.id,
        req.body.title,
        req.body.description,
        req.body.category,
        filename,
        req.session.passport.user.username,
      ],
      function (err) {
        if (err) {
          return next(err);
        }
        return res.redirect("/" + (req.body.filter || ""));
      }
    );
  }
);

// Creazione nuovo commento
router.post("/createComment", function (req, res, next) {
  const projectId = req.body.projectId;
  const description = req.body.description;
  db.run(
    "INSERT INTO documents_comments (user_id,user_name,project_id,description) VALUES (?,?,?,?)",
    [
      req.session.passport.user.id,
      req.session.passport.user.username,
      projectId,
      description,
    ],
    function (err) {
      if (err) {
        console.log(err);
        return next(err);
      }
      return res.redirect(req.get("referer"));
    }
  );
});

//ottengo tutti i progetti nel db di quell'utente loggato
router.get("/", fetchProjects);

router.get(
  "/creatore",
  /*
  function (req, res, next) {
    //se l'utente non è loggato
    if (!req.session.passport.user) {
      return res.render("/login");
    }
    next();
  },
  */
  fetchProjects
);

router.get(
  "/project-details/:id",
  fetchProjectsById,
  fetchFollowById,
  fetchCommentsById,
  documentRoute.fetchDocuments,
  documentRoute.fetchFollowDocById
);

//modifica progetto non va per l'immagine
router.post(
  "/modifica",
  upload.single("image"),
  async function (req, res, next) {
    const filename = "/uploads/" + req.file.filename;
    const id = req.body.id_prog;
    db.run(
      "UPDATE projects SET title = ?, description = ?, category = ?, image = ? WHERE id = ?",
      [req.body.title, req.body.description, req.body.category, filename, id],
      function (err) {
        if (err) {
          return next(err);
        }
        return res.status(200).redirect("/" + (req.body.filter || ""));
      }
    );
  }
);

/*
//oppure così
router.post(
  "/modifica/:id)",
  function (req, res, next) {
    db.run(
      "DELETE FROM projects WHERE id = ? AND owner_id = ?",
      [req.params.id, req.user.id],
      function (err) {
        if (err) {
          return next(err);
        }
        return res.redirect("/" + (req.body.filter || ""));
      }
    );
  },
  function (req, res, next) {
    db.run(
      "UPDATE projects SET title = ?, description = ?, category = ?, image = ? WHERE id = ? AND owner_id = ?",
      [
        req.body.title,
        req.body.description,
        req.body.category,
        req.body.image,
        req.params.id,
        req.user.id,
      ],
      function (err) {
        if (err) {
          return next(err);
        }
        return res.redirect("/" + (req.body.filter || ""));
      }
    );
  }
);
*/

router.post("/search", fetchProjects, async function (req, res, next) {
  const searchValue =
    req.body.searchValue && req.body.searchValue.toLowerCase();

  res.locals.projects = res.locals.projects.filter(function (project) {
    return (
      project.title.toLowerCase().includes(searchValue) ||
      project.category.toLowerCase().includes(searchValue)
    );
  });

  res.json(res.locals.projects);
});

router.post("/addFollow", function (req, res, next) {
  const id_project = req.body.projectId;
  db.run(
    "INSERT INTO follow (user,id_prog) VALUES (?,?)",
    [req.session.passport.user.id, id_project],
    function (err) {
      if (err) {
        return next(err);
      }

      return res.redirect(req.get("referer"));
    }
  );
});

router.post("/removeFollow", function (req, res, next) {
  const id_project = req.body.projectId;

  db.run(
    "DELETE FROM follow  WHERE user=? AND id_prog=?",
    [req.session.passport.user.id, parseInt(id_project)],
    function (err) {
      if (err) {
        return next(err);
      }

      return res.redirect(req.get("referer"));
    }
  );
});

//elimina progetto
router.post("/deleteProject", function (req, res, next) {
  const id = req.body.deleteProjectId;

  db.run("DELETE FROM projects WHERE id = ?", [id], function (err) {
    if (err) {
      return next(err);
    }
    return res.redirect("/" + (req.body.filter || ""));
  });
});

//modifica commento
router.post("/updateComment", function (req, res, next) {
  const description = req.body.description;
  const comment_id = req.body.comment_id;

  db.run(
    "UPDATE documents_comments SET description=? WHERE id = ?",
    [description, comment_id],
    function (err) {
      if (err) {
        return next(err);
      }
      return res.redirect(req.get("referer"));
    }
  );
});

module.exports = router;
